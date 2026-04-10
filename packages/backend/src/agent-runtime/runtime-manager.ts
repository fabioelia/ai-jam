import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { RuntimeClient, type SessionInfo } from './runtime-client.js';
import { config } from '../config.js';
import { broadcastToBoard, broadcastToPty } from '../websocket/socket-server.js';
import { db } from '../db/connection.js';
import { agentSessions, chatSessions } from '../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';
import { processAssistantMessage } from '../services/planning-service.js';

let client: RuntimeClient | null = null;
let runtimeProcess: ChildProcess | null = null;

// Accumulate output for planning sessions to parse structured actions
const planningOutputBuffers = new Map<string, string>();

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

  runtimeProcess = spawn('npx', ['tsx', 'src/index.ts'], {
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

    // Accumulate output for planning sessions
    const existing = planningOutputBuffers.get(payload.sessionId);
    if (existing !== undefined) {
      planningOutputBuffers.set(payload.sessionId, existing + payload.chunk);
    }

    // Check if this is a chat/planning session
    const chatSession = await getChatSessionFromDb(payload.sessionId);
    if (chatSession) {
      // Start accumulating if not already
      if (!planningOutputBuffers.has(payload.sessionId)) {
        planningOutputBuffers.set(payload.sessionId, payload.chunk);
      }
      // Stream output to feature room for real-time display
      const { broadcastToFeature } = await import('../websocket/socket-server.js');
      broadcastToFeature(chatSession.featureId, 'chat:message', {
        sessionId: payload.sessionId,
        role: 'assistant_stream',
        content: payload.chunk,
      });
      return;
    }

    // For non-planning sessions, broadcast to board
    const session = await getSessionFromDb(payload.sessionId);
    if (session?.ticketId) {
      const projectId = await getProjectIdForTicket(session.ticketId);
      if (projectId) {
        broadcastToBoard(projectId, 'agent:session:output', {
          sessionId: payload.sessionId,
          chunk: payload.chunk,
        });
      }
    }
  });

  c.on('session:completed', async (payload: { sessionId: string; exitCode: number | null; outputSummary: string | null }) => {
    // Check if this is a planning session — process accumulated output
    const accumulatedOutput = planningOutputBuffers.get(payload.sessionId);
    if (accumulatedOutput) {
      planningOutputBuffers.delete(payload.sessionId);
      try {
        await processAssistantMessage(payload.sessionId, accumulatedOutput);
      } catch (err) {
        console.error('[runtime-manager] Failed to process planning output:', err);
      }
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

    const session = await getSessionFromDb(payload.sessionId);

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

  await c.spawnSession({
    sessionId: newId,
    personaType: original.personaType,
    model: 'sonnet',
    prompt: original.prompt || '',
    workingDirectory: original.workingDirectory || process.cwd(),
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
  // Import tickets table inline to avoid circular deps
  const { tickets } = await import('../db/schema.js');
  const [ticket] = await db.select({ projectId: tickets.projectId }).from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  return ticket?.projectId ?? null;
}
