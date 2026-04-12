/**
 * PTY Daemon Manager — connects to the pty-daemon process for interactive sessions.
 *
 * Handles planning (chat) and scan sessions. Mirrors runtime-manager.ts
 * but only for interactive session types.
 */

import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { RuntimeClient, type SessionInfo } from './runtime-client.js';
import { config } from '../config.js';
import { broadcastToPty } from '../websocket/socket-server.js';
import { db } from '../db/connection.js';
import { chatSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { processAssistantMessage } from '../services/planning-service.js';
import {
  validateKnowledgeFiles,
  buildValidationFollowup,
  finalizeScan,
} from '../services/scan-service.js';

let client: RuntimeClient | null = null;
let ptyProcess: ChildProcess | null = null;

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
  completedCycles: number;
  lastActivity: string;
  validationTimer: ReturnType<typeof setTimeout> | null;
}

const scanSessionStates = new Map<string, ScanSessionState>();

/**
 * Register a scan session for post-response validation.
 */
export function registerPtyScanSession(
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
const pendingChunks = new Map<string, string[]>();

/**
 * Get or create the pty-daemon client singleton.
 */
export function getPtyDaemonClient(): RuntimeClient {
  if (!client) {
    client = new RuntimeClient(config.ptyDaemonSocket);
  }
  return client;
}

/**
 * Start (or connect to) the pty-daemon process.
 */
export async function startPtyDaemon(): Promise<void> {
  const runtimeDir = join(process.cwd(), '..', 'agent-runtime');
  const c = getPtyDaemonClient();

  // Try connecting first — maybe the pty-daemon is already running
  try {
    await c.connect();
    console.log('[pty-daemon-manager] Connected to existing pty-daemon');
    wireEvents(c);
    return;
  } catch {
    // Not running, spawn it
  }

  console.log('[pty-daemon-manager] Spawning pty-daemon...');

  ptyProcess = spawn('npx', ['tsx', 'src/pty-daemon.ts'], {
    cwd: runtimeDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PTY_DAEMON_SOCKET: config.ptyDaemonSocket,
    },
  });

  ptyProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[pty-daemon] ${data}`);
  });

  ptyProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[pty-daemon:err] ${data}`);
  });

  ptyProcess.on('exit', (code) => {
    console.log(`[pty-daemon-manager] pty-daemon exited with code ${code}`);
    ptyProcess = null;
  });

  // Wait for the socket to be ready
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  try {
    await c.connect();
    console.log('[pty-daemon-manager] Connected to pty-daemon');
    wireEvents(c);
  } catch (err) {
    console.error('[pty-daemon-manager] Failed to connect to pty-daemon:', err);
  }
}

/**
 * Stop the pty-daemon process.
 */
export function stopPtyDaemon() {
  if (client) {
    client.disconnect();
    client = null;
  }
  if (ptyProcess) {
    ptyProcess.kill('SIGTERM');
    ptyProcess = null;
  }
}

/**
 * Wire up pty-daemon events for planning + scan sessions.
 */
function wireEvents(c: RuntimeClient) {
  c.on('session:activity', async (payload: { sessionId: string; activity: string }) => {
    // -- Scan session validation --
    const scanState = scanSessionStates.get(payload.sessionId);
    if (scanState) {
      if (payload.activity === 'busy') {
        if (scanState.validationTimer) {
          clearTimeout(scanState.validationTimer);
          scanState.validationTimer = null;
        }
      }
      if (payload.activity === 'waiting' && scanState.lastActivity === 'busy') {
        scanState.completedCycles++;
        if (scanState.completedCycles >= 2) {
          if (scanState.validationTimer) clearTimeout(scanState.validationTimer);
          scanState.validationTimer = setTimeout(() => {
            scanState.validationTimer = null;
            handleScanValidation(payload.sessionId, scanState).catch((err) => {
              console.error('[pty-daemon-manager] Scan validation error:', err);
            });
          }, 3000);
        }
      }
      scanState.lastActivity = payload.activity;
      return;
    }

    // -- Planning session: parse structured actions after each response --
    if (planningOutputBuffers.has(payload.sessionId)) {
      const lastAct = planningLastActivity.get(payload.sessionId) || 'idle';
      planningLastActivity.set(payload.sessionId, payload.activity);

      if (payload.activity === 'waiting' && lastAct === 'busy') {
        const buffer = planningOutputBuffers.get(payload.sessionId) || '';
        if (buffer.length > 0) {
          planningOutputBuffers.set(payload.sessionId, '');
          try {
            await processAssistantMessage(payload.sessionId, buffer);
          } catch (err) {
            console.error('[pty-daemon-manager] Failed to process planning response:', err);
          }
        }
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
    if (!pendingLookups.has(payload.sessionId)) {
      pendingLookups.add(payload.sessionId);
      const chatSession = await getChatSessionFromDb(payload.sessionId);
      if (chatSession) {
        const buffered = pendingChunks.get(payload.sessionId) || [];
        pendingChunks.delete(payload.sessionId);
        pendingLookups.delete(payload.sessionId);
        const allChunks = payload.chunk + buffered.join('');

        planningOutputBuffers.set(payload.sessionId, allChunks);
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
      const chunks = pendingChunks.get(payload.sessionId) || [];
      chunks.push(payload.chunk);
      pendingChunks.set(payload.sessionId, chunks);
    }
  });

  c.on('session:completed', async (payload: { sessionId: string; exitCode: number | null; outputSummary: string | null }) => {
    // Process any remaining planning output
    const accumulatedOutput = planningOutputBuffers.get(payload.sessionId);
    planningOutputBuffers.delete(payload.sessionId);
    planningLastActivity.delete(payload.sessionId);
    if (accumulatedOutput && accumulatedOutput.length > 0) {
      try {
        await processAssistantMessage(payload.sessionId, accumulatedOutput);
      } catch (err) {
        console.error('[pty-daemon-manager] Failed to process planning output:', err);
      }
    }

    // Check if this is a scan session — run final validation
    const scanState = scanSessionStates.get(payload.sessionId);
    if (scanState) {
      if (scanState.validationTimer) {
        clearTimeout(scanState.validationTimer);
        scanState.validationTimer = null;
      }
      try {
        await handleScanFinalization(payload.sessionId, scanState, payload.exitCode);
      } catch (err) {
        console.error('[pty-daemon-manager] Failed to finalize scan:', err);
      }
      scanSessionStates.delete(payload.sessionId);
    }

    const isFailed = payload.exitCode !== 0;

    // Update chat session status
    try {
      await db.update(chatSessions)
        .set({ status: isFailed ? 'failed' : 'completed' })
        .where(eq(chatSessions.id, payload.sessionId));
    } catch { /* ignore */ }
  });
}

// -- Scan validation helpers --

async function handleScanValidation(sessionId: string, state: ScanSessionState) {
  const { present, missing } = validateKnowledgeFiles(state.projectId);
  console.log(`[pty-daemon-manager] Scan validation for ${sessionId.slice(0, 8)}: ${present.length} present, ${missing.length} missing`);

  if (missing.length === 0) {
    console.log(`[pty-daemon-manager] All knowledge files present — finalizing scan`);
    const c = getPtyDaemonClient();
    if (c.isConnected) {
      try { await c.killSession(sessionId); } catch { /* ignore */ }
    }
    await finalizeScan(state.scanId, state.projectId, present);
    scanSessionStates.delete(sessionId);
    return;
  }

  state.validationAttempts++;
  if (state.validationAttempts > state.maxAttempts) {
    console.log(`[pty-daemon-manager] Max validation attempts reached — finalizing with ${present.length}/${present.length + missing.length} files`);
    const c = getPtyDaemonClient();
    if (c.isConnected) {
      try { await c.killSession(sessionId); } catch { /* ignore */ }
    }
    await finalizeScan(state.scanId, state.projectId, present, missing);
    scanSessionStates.delete(sessionId);
    return;
  }

  console.log(`[pty-daemon-manager] Sending follow-up for missing files: ${missing.join(', ')} (attempt ${state.validationAttempts}/${state.maxAttempts})`);
  state.completedCycles = 1;
  state.lastActivity = 'waiting';
  const followup = buildValidationFollowup(state.knowledgePath, present, missing);
  const c = getPtyDaemonClient();
  if (c.isConnected) {
    try {
      await c.sendPrompt(sessionId, followup);
    } catch (err) {
      console.error('[pty-daemon-manager] Failed to send scan follow-up:', err);
      await finalizeScan(state.scanId, state.projectId, present, missing);
      scanSessionStates.delete(sessionId);
    }
  }
}

async function handleScanFinalization(sessionId: string, state: ScanSessionState, exitCode: number | null) {
  const { present, missing } = validateKnowledgeFiles(state.projectId);
  console.log(`[pty-daemon-manager] Scan session ${sessionId.slice(0, 8)} completed (exit ${exitCode}): ${present.length} files present, ${missing.length} missing`);
  await finalizeScan(state.scanId, state.projectId, present, missing.length > 0 ? missing : undefined);
}

// -- Helpers --

async function getChatSessionFromDb(sessionId: string) {
  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
  return session || null;
}
