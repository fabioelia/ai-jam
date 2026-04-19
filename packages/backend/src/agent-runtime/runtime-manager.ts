import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import jwt from 'jsonwebtoken';
import { RuntimeClient, type SessionInfo } from './runtime-client.js';
import { config } from '../config.js';
import { broadcastToBoard, broadcastToPty } from '../websocket/socket-server.js';
import { db } from '../db/connection.js';
import { agentSessions, chatSessions, tickets, ticketNotes } from '../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';
import { processAssistantMessage } from '../services/planning-service.js';
import {
  validateKnowledgeFiles,
  buildValidationFollowup,
  finalizeScan,
} from '../services/scan-service.js';
import { createAttentionItem } from '../services/attention-service.js';
import { notifyTicketStakeholders } from '../services/notification-service.js';

let client: RuntimeClient | null = null;
let runtimeProcess: ChildProcess | null = null;

// Accumulate output for planning sessions to parse structured actions
const planningOutputBuffers = new Map<string, string>();
// Track last activity per planning session for busy→waiting detection
const planningLastActivity = new Map<string, string>();

// -- Scan session validation state --

interface ScanSessionState {
  projectId: string;
  scanId: string;
  knowledgePath: string;
  validationAttempts: number;
  maxAttempts: number;
  /** Number of busy→waiting transitions seen (skip the first — it's TUI startup). */
  completedCycles: number;
  lastActivity: string;
  validationTimer: ReturnType<typeof setTimeout> | null;
}

const scanSessionStates = new Map<string, ScanSessionState>();

/**
 * Register a scan session for post-response validation.
 * Called from scan-service BEFORE spawning so the state is ready
 * when the first activity events arrive.
 */
export function registerScanSession(
  sessionId: string,
  opts: { projectId: string; scanId: string; knowledgePath: string; maxAttempts: number },
) {
  scanSessionStates.set(sessionId, {
    ...opts,
    validationAttempts: 0,
    completedCycles: 0,
    lastActivity: 'idle',
    validationTimer: null,
  });
}

// Track which session IDs have a pending DB lookup to avoid race conditions
const pendingLookups = new Set<string>();
// Buffer chunks that arrive during the initial DB lookup
const pendingChunks = new Map<string, string[]>();

/**
 * Get or create the runtime client singleton.
 */
export function getRuntimeClient(): RuntimeClient {
  if (!client) {
    client = new RuntimeClient(config.agentRuntimeSocket);
  }
  return client;
}

/**
 * Start the agent-runtime process and connect to it.
 */
export async function startRuntime(): Promise<void> {
  const runtimeDir = join(process.cwd(), '..', 'agent-runtime');
  const c = getRuntimeClient();

  // Try connecting first — maybe the runtime is already running
  try {
    await c.connect();
    console.log('[runtime-manager] Connected to existing agent-runtime');
    wireEvents(c);
    startStalledSessionDetector();
    return;
  } catch {
    // Not running, spawn it
  }

  console.log('[runtime-manager] Spawning agent-runtime...');

  runtimeProcess = spawn('pnpm', ['dev'], {
    cwd: runtimeDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      AGENT_RUNTIME_SOCKET: config.agentRuntimeSocket,
      MAX_CONCURRENT_AGENTS: String(config.maxConcurrentAgents),
    },
  });

  runtimeProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[agent-runtime] ${data}`);
  });

  runtimeProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[agent-runtime:err] ${data}`);
  });

  runtimeProcess.on('exit', (code) => {
    console.log(`[runtime-manager] Agent-runtime exited with code ${code}`);
    runtimeProcess = null;
  });

  // Wait a moment for the socket to be ready, then connect
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  try {
    await c.connect();
    console.log('[runtime-manager] Connected to agent-runtime');
    wireEvents(c);
    startStalledSessionDetector();
  } catch (err) {
    console.error('[runtime-manager] Failed to connect to agent-runtime:', err);
  }
}

/**
 * Stop the agent-runtime process.
 */
export function stopRuntime() {
  stopStalledSessionDetector();
  if (client) {
    client.disconnect();
    client = null;
  }
  if (runtimeProcess) {
    runtimeProcess.kill('SIGTERM');
    runtimeProcess = null;
  }
}

/**
 * Wire up runtime events to Socket.IO broadcasts and DB updates.
 */
function wireEvents(c: RuntimeClient) {
  c.on('session:started', async (payload: { sessionId: string; personaType: string; ptyInstanceId: string }) => {
    // Update DB
    try {
      await db.update(agentSessions)
        .set({
          status: 'running',
          ptyInstanceId: payload.ptyInstanceId,
          startedAt: new Date(),
        })
        .where(eq(agentSessions.id, payload.sessionId));
    } catch (err) {
      console.error('[runtime-manager] Failed to update session in DB:', err);
    }

    // Get the ticket ID for broadcasting
    const session = await getSessionFromDb(payload.sessionId);
    if (session?.ticketId) {
      const projectId = await getProjectIdForTicket(session.ticketId);
      if (projectId) {
        broadcastToBoard(projectId, 'agent:session:started', {
          sessionId: payload.sessionId,
          ticketId: session.ticketId,
          personaType: payload.personaType,
        });
      }
    }
  });

  c.on('session:activity', async (payload: { sessionId: string; activity: string }) => {
    try {
      await db.update(agentSessions)
        .set({ activity: payload.activity })
        .where(eq(agentSessions.id, payload.sessionId));
    } catch { /* ignore */ }

    // -- Scan session validation --
    const scanState = scanSessionStates.get(payload.sessionId);
    if (scanState) {
      if (payload.activity === 'busy') {
        // Cancel any pending validation timer (Claude started working again)
        if (scanState.validationTimer) {
          clearTimeout(scanState.validationTimer);
          scanState.validationTimer = null;
        }
      }
      // Track busy→waiting transitions. The first cycle is TUI startup
      // (sendPromptWhenReady dismisses the trust dialog). The second cycle
      // is Claude finishing its actual response — that's when we validate.
      if (payload.activity === 'waiting' && scanState.lastActivity === 'busy') {
        scanState.completedCycles++;
        // Skip cycle 1 (TUI startup). Validate on cycle 2+ (real responses).
        if (scanState.completedCycles >= 2) {
          if (scanState.validationTimer) clearTimeout(scanState.validationTimer);
          scanState.validationTimer = setTimeout(() => {
            scanState.validationTimer = null;
            handleScanValidation(payload.sessionId, scanState).catch((err) => {
              console.error('[runtime-manager] Scan validation error:', err);
            });
          }, 3000);
        }
      }
      scanState.lastActivity = payload.activity;
      return; // Don't broadcast scan activity to board
    }

    // -- Planning session: parse structured actions after each response --
    if (planningOutputBuffers.has(payload.sessionId)) {
      const lastAct = planningLastActivity.get(payload.sessionId) || 'idle';
      planningLastActivity.set(payload.sessionId, payload.activity);

      if (payload.activity === 'waiting' && lastAct === 'busy') {
        const buffer = planningOutputBuffers.get(payload.sessionId) || '';
        if (buffer.length > 0) {
          // Clear buffer before processing so new output from the next
          // user message doesn't get mixed in
          planningOutputBuffers.set(payload.sessionId, '');
          try {
            await processAssistantMessage(payload.sessionId, buffer);
          } catch (err) {
            console.error('[runtime-manager] Failed to process planning response:', err);
          }
        }
      }
      return; // Planning sessions don't broadcast to board
    }

    const session = await getSessionFromDb(payload.sessionId);
    if (session?.ticketId) {
      const projectId = await getProjectIdForTicket(session.ticketId);
      if (projectId) {
        broadcastToBoard(projectId, 'agent:session:activity', {
          sessionId: payload.sessionId,
          activity: payload.activity,
        });
      }
    }
  });

  c.on('session:output', async (payload: { sessionId: string; chunk: string }) => {
    // Always forward raw PTY data to attached terminal clients
    broadcastToPty(payload.sessionId, 'pty:data', { sessionId: payload.sessionId, data: payload.chunk });

    // Accumulate output for planning sessions (fast path — buffer already exists)
    const existing = planningOutputBuffers.get(payload.sessionId);
    if (existing !== undefined) {
      planningOutputBuffers.set(payload.sessionId, existing + payload.chunk);
      // Still need to stream to feature room — look up cached featureId
      const chatSession = await getChatSessionFromDb(payload.sessionId);
      if (chatSession) {
        const { broadcastToFeature } = await import('../websocket/socket-server.js');
        broadcastToFeature(chatSession.featureId, 'chat:message', {
          sessionId: payload.sessionId,
          role: 'assistant_stream',
          content: payload.chunk,
        });
      }
      return;
    }

    // Scan sessions: just stream PTY output, no accumulation needed
    if (scanSessionStates.has(payload.sessionId)) {
      return;
    }

    // Check if this is a chat/planning session (only runs once per session)
    // If a lookup is already in flight, buffer the chunk and return
    if (!pendingLookups.has(payload.sessionId)) {
      pendingLookups.add(payload.sessionId);
      const chatSession = await getChatSessionFromDb(payload.sessionId);
      if (chatSession) {
        // Collect any chunks that arrived during the DB lookup
        const buffered = pendingChunks.get(payload.sessionId) || [];
        pendingChunks.delete(payload.sessionId);
        pendingLookups.delete(payload.sessionId);
        const allChunks = payload.chunk + buffered.join('');

        planningOutputBuffers.set(payload.sessionId, allChunks);
        // Stream output to feature room for real-time display
        const { broadcastToFeature } = await import('../websocket/socket-server.js');
        broadcastToFeature(chatSession.featureId, 'chat:message', {
          sessionId: payload.sessionId,
          role: 'assistant_stream',
          content: allChunks,
        });
        return;
      }
      pendingLookups.delete(payload.sessionId);
    } else {
      // Lookup in flight — buffer and return, the in-flight handler will process
      const chunks = pendingChunks.get(payload.sessionId) || [];
      chunks.push(payload.chunk);
      pendingChunks.set(payload.sessionId, chunks);
      return;
    }

    // For non-planning, non-scan sessions, broadcast to board
    const agentSession = await getSessionFromDb(payload.sessionId);
    if (agentSession?.ticketId) {
      const projectId = await getProjectIdForTicket(agentSession.ticketId);
      if (projectId) {
        broadcastToBoard(projectId, 'agent:session:output', {
          sessionId: payload.sessionId,
          chunk: payload.chunk,
        });
      }
    }
  });

  c.on('session:completed', async (payload: { sessionId: string; exitCode: number | null; outputSummary: string | null }) => {
    // Check if this is a planning session — process any remaining output
    const accumulatedOutput = planningOutputBuffers.get(payload.sessionId);
    planningOutputBuffers.delete(payload.sessionId);
    planningLastActivity.delete(payload.sessionId);
    if (accumulatedOutput && accumulatedOutput.length > 0) {
      try {
        await processAssistantMessage(payload.sessionId, accumulatedOutput);
      } catch (err) {
        console.error('[runtime-manager] Failed to process planning output:', err);
      }
    }

    // Check if this is a scan session — run final validation
    const scanState = scanSessionStates.get(payload.sessionId);
    if (scanState) {
      // Cancel any pending validation timer
      if (scanState.validationTimer) {
        clearTimeout(scanState.validationTimer);
        scanState.validationTimer = null;
      }
      try {
        await handleScanFinalization(payload.sessionId, scanState, payload.exitCode);
      } catch (err) {
        console.error('[runtime-manager] Failed to finalize scan:', err);
      }
      scanSessionStates.delete(payload.sessionId);
    }

    const isFailed = payload.exitCode !== 0;

    try {
      await db.update(agentSessions)
        .set({
          status: isFailed ? 'failed' : 'completed',
          activity: 'idle',
          outputSummary: payload.outputSummary,
          completedAt: new Date(),
        })
        .where(eq(agentSessions.id, payload.sessionId));
    } catch { /* ignore */ }

    // Also update chat sessions (planning sessions use the same sessionId)
    try {
      await db.update(chatSessions)
        .set({ status: isFailed ? 'failed' : 'completed' })
        .where(eq(chatSessions.id, payload.sessionId));
    } catch { /* ignore */ }

    const session = await getSessionFromDb(payload.sessionId);

    // Auto-write progress note so successor personas / retries inherit context
    if (session?.ticketId && payload.outputSummary) {
      try {
        const statusLabel = isFailed ? 'FAILED' : 'COMPLETED';
        await db.insert(ticketNotes).values({
          ticketId: session.ticketId,
          authorType: 'agent',
          authorId: session.personaType,
          content: `[${statusLabel}] ${session.personaType} session (attempt ${session.retryCount + 1}):\n\n${payload.outputSummary}`,
          handoffFrom: session.personaType,
          source: 'api',
        });
      } catch (err) {
        console.error('[runtime-manager] Failed to write progress note:', err);
      }
    }

    // Auto-retry failed sessions
    if (isFailed && session && session.retryCount < session.maxRetries && session.ticketId) {
      console.log(`[runtime-manager] Auto-retrying session ${payload.sessionId} (attempt ${session.retryCount + 1}/${session.maxRetries})`);
      try {
        await retrySession(payload.sessionId);
        return; // Don't broadcast failure — we're retrying
      } catch (err) {
        console.error('[runtime-manager] Auto-retry failed:', err);
      }
    }

    // Create attention item for failed sessions after max retries exhausted
    if (isFailed && session && session.ticketId && session.retryCount >= session.maxRetries) {
      const projectId = await getProjectIdForTicket(session.ticketId);
      if (projectId) {
        const [ticket] = await db.select().from(tickets).where(eq(tickets.id, session.ticketId));
        createAttentionItem({
          projectId,
          featureId: ticket?.featureId ?? undefined,
          ticketId: session.ticketId,
          type: 'failed_session',
          title: `${session.personaType} session failed after ${session.retryCount + 1} attempts`,
          description: payload.outputSummary ?? undefined,
          metadata: {
            sessionId: payload.sessionId,
            personaType: session.personaType,
            retryCount: session.retryCount,
            maxRetries: session.maxRetries,
            exitCode: payload.exitCode,
          },
        }).catch((err) => {
          console.error('[runtime-manager] Failed to create attention item:', err);
        });
      }
    }

    // Notify stakeholders on successful completion (skip scanner sessions — they use scan_completed)
    if (!isFailed && session?.ticketId) {
      try {
        const [ticket] = await db.select({ title: tickets.title, projectId: tickets.projectId })
          .from(tickets).where(eq(tickets.id, session.ticketId));
        if (ticket) {
          notifyTicketStakeholders(
            session.ticketId,
            'agent_completed',
            `${session.personaType} finished on ${ticket.title}`,
            payload.outputSummary,
            `/projects/${ticket.projectId}/board?ticket=${session.ticketId}`,
            'system',
          ).catch((err) => {
            console.error('[runtime-manager] Failed to notify stakeholders:', err);
          });
        }
      } catch (err) {
        console.error('[runtime-manager] Failed to look up ticket for notification:', err);
      }
    }

    if (session?.ticketId) {
      const projectId = await getProjectIdForTicket(session.ticketId);
      if (projectId) {
        broadcastToBoard(projectId, 'agent:session:completed', {
          sessionId: payload.sessionId,
          summary: payload.outputSummary,
          failed: isFailed,
        });
      }
    }
  });
}

/**
 * Handle scan validation after Claude finishes a response.
 * Checks expected files on disk, sends follow-up if needed.
 */
async function handleScanValidation(sessionId: string, state: ScanSessionState) {
  const { present, missing } = validateKnowledgeFiles(state.projectId);
  console.log(`[runtime-manager] Scan validation for ${sessionId.slice(0, 8)}: ${present.length} present, ${missing.length} missing`);

  if (missing.length === 0) {
    // All files present — kill session and finalize
    console.log(`[runtime-manager] All knowledge files present — finalizing scan`);
    const c = getRuntimeClient();
    if (c.isConnected) {
      try { await c.killSession(sessionId); } catch { /* ignore */ }
    }
    await finalizeScan(state.scanId, state.projectId, present);
    scanSessionStates.delete(sessionId);
    return;
  }

  state.validationAttempts++;
  if (state.validationAttempts > state.maxAttempts) {
    // Max attempts reached — finalize with partial results
    console.log(`[runtime-manager] Max validation attempts reached — finalizing with ${present.length}/${present.length + missing.length} files`);
    const c = getRuntimeClient();
    if (c.isConnected) {
      try { await c.killSession(sessionId); } catch { /* ignore */ }
    }
    await finalizeScan(state.scanId, state.projectId, present, missing);
    scanSessionStates.delete(sessionId);
    return;
  }

  // Send follow-up prompt about missing files
  console.log(`[runtime-manager] Sending follow-up for missing files: ${missing.join(', ')} (attempt ${state.validationAttempts}/${state.maxAttempts})`);
  // After follow-up, next busy→waiting = Claude finished responding.
  // Set to 1 so the next cycle (incrementing to 2) triggers validation.
  state.completedCycles = 1;
  state.lastActivity = 'waiting';
  const followup = buildValidationFollowup(state.knowledgePath, present, missing);
  const c = getRuntimeClient();
  if (c.isConnected) {
    try {
      await c.sendPrompt(sessionId, followup);
    } catch (err) {
      console.error('[runtime-manager] Failed to send scan follow-up:', err);
      // Finalize with what we have
      await finalizeScan(state.scanId, state.projectId, present, missing);
      scanSessionStates.delete(sessionId);
    }
  }
}

/**
 * Handle scan finalization when the session completes (exits).
 * Runs a final validation check regardless of exit code.
 */
async function handleScanFinalization(sessionId: string, state: ScanSessionState, exitCode: number | null) {
  const { present, missing } = validateKnowledgeFiles(state.projectId);
  console.log(`[runtime-manager] Scan session ${sessionId.slice(0, 8)} completed (exit ${exitCode}): ${present.length} files present, ${missing.length} missing`);
  await finalizeScan(state.scanId, state.projectId, present, missing.length > 0 ? missing : undefined);
}

/**
 * Retry a failed agent session: creates a new session with incremented retryCount.
 */
export async function retrySession(failedSessionId: string): Promise<string> {
  const [original] = await db.select().from(agentSessions).where(eq(agentSessions.id, failedSessionId));
  if (!original) throw new Error('Session not found');
  if (original.status !== 'failed') throw new Error('Can only retry failed sessions');
  if (original.retryCount >= original.maxRetries) throw new Error('Max retries exceeded');

  const { v4: uuid } = await import('uuid');
  const newId = uuid();

  // Create the retry session in DB
  await db.insert(agentSessions).values({
    id: newId,
    ticketId: original.ticketId,
    personaType: original.personaType,
    status: 'pending',
    activity: 'idle',
    prompt: original.prompt,
    workingDirectory: original.workingDirectory,
    retryCount: original.retryCount + 1,
    maxRetries: original.maxRetries,
  });

  // Spawn via runtime
  const c = getRuntimeClient();
  if (!c.isConnected) throw new Error('Agent runtime not connected');

  // Reconstruct mcpContext for execution sessions (those with a ticketId)
  let mcpContext: {
    sessionId: string;
    projectId: string;
    featureId: string;
    ticketId?: string;
    userId: string;
    authToken: string;
    apiBaseUrl?: string;
    phase: 'planning' | 'execution';
  } | undefined;

  if (original.ticketId) {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, original.ticketId));
    if (ticket) {
      // Generate a service token for the retried session
      const mcpToken = jwt.sign(
        { userId: 'system', email: 'system@ai-jam.local' },
        config.jwtSecret,
        { expiresIn: '2h' },
      );

      mcpContext = {
        sessionId: newId,
        projectId: ticket.projectId,
        featureId: ticket.featureId,
        ticketId: original.ticketId,
        userId: 'system',
        authToken: mcpToken,
        apiBaseUrl: `http://localhost:${config.port}`,
        phase: 'execution',
      };
    }
  }

  await c.spawnSession({
    sessionId: newId,
    sessionType: 'execution',
    personaType: original.personaType,
    model: 'sonnet',
    prompt: original.prompt || '',
    workingDirectory: original.workingDirectory || process.cwd(),
    mcpContext,
  });

  return newId;
}

/**
 * Detect and mark stalled sessions (running for too long with no activity).
 * Called periodically from a timer.
 */
const STALL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let stalledCheckTimer: ReturnType<typeof setInterval> | null = null;

export function startStalledSessionDetector() {
  if (stalledCheckTimer) return;

  stalledCheckTimer = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STALL_TIMEOUT_MS);

      // Find running sessions started before the cutoff
      const stalled = await db.select()
        .from(agentSessions)
        .where(
          and(
            eq(agentSessions.status, 'running'),
            lt(agentSessions.startedAt, cutoff),
          )
        );

      for (const session of stalled) {
        console.warn(`[runtime-manager] Stalled session detected: ${session.id} (${session.personaType}), running since ${session.startedAt}`);

        // Kill the PTY process
        const c = getRuntimeClient();
        if (c.isConnected) {
          try { await c.killSession(session.id); } catch { /* ignore */ }
        }

        // Mark as failed — this will trigger the auto-retry in the completion handler
        await db.update(agentSessions)
          .set({
            status: 'failed',
            activity: 'idle',
            outputSummary: 'Session timed out (stalled)',
            completedAt: new Date(),
          })
          .where(eq(agentSessions.id, session.id));

        // Broadcast
        if (session.ticketId) {
          const projectId = await getProjectIdForTicket(session.ticketId);
          if (projectId) {
            broadcastToBoard(projectId, 'agent:session:completed', {
              sessionId: session.id,
              summary: 'Session timed out (stalled)',
              failed: true,
            });
          }
        }
      }
    } catch (err) {
      console.error('[runtime-manager] Stalled session check error:', err);
    }
  }, 60_000); // check every minute
}

export function stopStalledSessionDetector() {
  if (stalledCheckTimer) {
    clearInterval(stalledCheckTimer);
    stalledCheckTimer = null;
  }
}

// -- Helpers --

async function getSessionFromDb(sessionId: string) {
  const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, sessionId)).limit(1);
  return session || null;
}

async function getChatSessionFromDb(sessionId: string) {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
  return session || null;
}

async function getProjectIdForTicket(ticketId: string): Promise<string | null> {
  const [ticket] = await db.select({ projectId: tickets.projectId }).from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  return ticket?.projectId ?? null;
}
