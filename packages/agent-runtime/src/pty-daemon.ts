/**
 * PTY Daemon — manages interactive Claude CLI sessions (planning + scan).
 *
 * Runs as a separate process from agent-runtime so backend hot-reloads
 * and agent-runtime restarts don't kill user planning sessions.
 *
 * Same package, different entry point. Uses its own Unix socket.
 */

import dotenv from 'dotenv';
import { createServer, type Socket } from 'net';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { unlinkSync, existsSync } from 'fs';
import { SessionManager } from './session-manager.js';
import type {
  RuntimeRequest,
  RuntimeResponse,
  RuntimeEvent,
} from './protocol.js';

// Load .env from monorepo root
const __dirname_index = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname_index, '..', '..', '..', '.env') });

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONAS_DIR = join(__dirname, '..', 'personas');
const SOCKET_PATH = process.env.PTY_DAEMON_SOCKET || '/tmp/ai-jam-pty-daemon.sock';
const MAX_CONCURRENT = parseInt(process.env.PTY_DAEMON_MAX_CONCURRENT || '8', 10);

// -- Session Manager --

const sessionManager = new SessionManager({
  personasDir: PERSONAS_DIR,
  maxConcurrent: MAX_CONCURRENT,
});

const personas = sessionManager.init();
console.log(`[pty-daemon] Loaded ${personas.length} personas: ${personas.map((p) => p.id).join(', ')}`);

// -- Connected clients --

const clients = new Set<Socket>();

function broadcastEvent(event: RuntimeEvent) {
  const line = JSON.stringify(event) + '\n';
  for (const client of clients) {
    if (!client.destroyed) {
      client.write(line);
    }
  }
}

// Forward session events to all connected clients
sessionManager.on('session:started', (payload) => {
  broadcastEvent({ type: 'event', event: 'session:started', payload });
});

sessionManager.on('session:activity', (payload) => {
  broadcastEvent({ type: 'event', event: 'session:activity', payload });
});

sessionManager.on('session:output', (payload) => {
  broadcastEvent({ type: 'event', event: 'session:output', payload });
});

sessionManager.on('session:completed', (payload) => {
  broadcastEvent({ type: 'event', event: 'session:completed', payload });
});

sessionManager.on('session:error', (payload) => {
  broadcastEvent({ type: 'event', event: 'session:error', payload });
});

// -- Request handler --

function handleRequest(req: RuntimeRequest): RuntimeResponse {
  try {
    switch (req.type) {
      case 'spawn_session': {
        const session = sessionManager.spawnSession(req.payload);
        return { type: 'response', id: req.id, ok: true, data: session };
      }

      case 'send_prompt': {
        const sent = sessionManager.sendPrompt(req.payload.sessionId, req.payload.prompt);
        if (!sent) {
          return { type: 'response', id: req.id, ok: false, error: `Session ${req.payload.sessionId} not found or not active` };
        }
        return { type: 'response', id: req.id, ok: true };
      }

      case 'kill_session': {
        const killed = sessionManager.killSession(req.payload.sessionId);
        if (!killed) {
          return { type: 'response', id: req.id, ok: false, error: `Session ${req.payload.sessionId} not found` };
        }
        return { type: 'response', id: req.id, ok: true };
      }

      case 'list_sessions': {
        const sessions = sessionManager.listSessions();
        return { type: 'response', id: req.id, ok: true, data: sessions };
      }

      case 'write_to_session': {
        const written = sessionManager.writeToSession(req.payload.sessionId, req.payload.data);
        if (!written) {
          return { type: 'response', id: req.id, ok: false, error: `Session ${req.payload.sessionId} not found or not active` };
        }
        return { type: 'response', id: req.id, ok: true };
      }

      case 'resize_session': {
        const resized = sessionManager.resizeSession(req.payload.sessionId, req.payload.cols, req.payload.rows);
        if (!resized) {
          return { type: 'response', id: req.id, ok: false, error: `Session ${req.payload.sessionId} not found` };
        }
        return { type: 'response', id: req.id, ok: true };
      }

      case 'get_session_status': {
        const session = sessionManager.getSession(req.payload.sessionId);
        if (!session) {
          return { type: 'response', id: req.id, ok: false, error: `Session ${req.payload.sessionId} not found` };
        }
        return { type: 'response', id: req.id, ok: true, data: session };
      }

      case 'get_session_buffer': {
        const buffer = sessionManager.getSessionBuffer(req.payload.sessionId);
        return { type: 'response', id: req.id, ok: true, data: { buffer } };
      }

      default:
        return { type: 'response', id: (req as RuntimeRequest).id || 'unknown', ok: false, error: `Unknown request type: ${(req as Record<string, string>).type}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: 'response', id: req.id, ok: false, error: message };
  }
}

// -- NDJSON socket server --

// Clean up stale socket file
if (existsSync(SOCKET_PATH)) {
  try {
    unlinkSync(SOCKET_PATH);
  } catch {
    // ignore
  }
}

const server = createServer((socket) => {
  clients.add(socket);
  console.log(`[pty-daemon] Client connected (${clients.size} total)`);

  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line) as RuntimeRequest;
        const response = handleRequest(req);
        socket.write(JSON.stringify(response) + '\n');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        socket.write(JSON.stringify({ type: 'response', id: 'parse_error', ok: false, error: `Parse error: ${message}` }) + '\n');
      }
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
    console.log(`[pty-daemon] Client disconnected (${clients.size} total)`);
  });

  socket.on('error', (err) => {
    console.error(`[pty-daemon] Client error:`, err.message);
    clients.delete(socket);
  });
});

server.listen(SOCKET_PATH, () => {
  console.log(`[pty-daemon] Listening on ${SOCKET_PATH}`);
  console.log(`[pty-daemon] Max concurrent interactive sessions: ${MAX_CONCURRENT}`);
});

// -- Graceful shutdown --

function shutdown() {
  console.log('\n[pty-daemon] Shutting down...');
  sessionManager.shutdown();
  server.close();
  if (existsSync(SOCKET_PATH)) {
    try { unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Periodic cleanup of old sessions
setInterval(() => {
  const sessions = sessionManager.listSessions();
  const oldCompleted = sessions.filter(
    (s) => (s.status === 'completed' || s.status === 'failed') &&
      s.completedAt &&
      Date.now() - new Date(s.completedAt).getTime() > 3600_000
  );
  for (const s of oldCompleted) {
    sessionManager.killSession(s.sessionId);
  }
}, 600_000); // every 10 min
