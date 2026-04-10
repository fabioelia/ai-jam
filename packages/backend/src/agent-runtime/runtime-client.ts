import { createConnection, type Socket } from 'net';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

// Protocol types — mirrored from agent-runtime protocol.ts
// These are the NDJSON message types shared between backend and agent-runtime

interface SpawnSessionPayload {
  sessionId: string;
  personaType: string;
  model: string;
  prompt: string;
  workingDirectory: string;
  contextFiles?: string[];
  addDirs?: string[];
  name?: string;
  interactive?: boolean;
}

interface RuntimeRequest {
  type: string;
  id: string;
  payload?: unknown;
}

interface RuntimeResponse {
  type: 'response';
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface RuntimeEvent {
  type: 'event';
  event: string;
  payload: unknown;
}

export interface SessionInfo {
  sessionId: string;
  personaType: string;
  model: string;
  ptyInstanceId: string;
  activity: 'busy' | 'waiting' | 'idle';
  status: 'starting' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
}

interface PendingRequest {
  resolve: (response: RuntimeResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * NDJSON client for communicating with the agent-runtime process.
 * Adapted from Colony's daemon-client.ts.
 */
export class RuntimeClient extends EventEmitter {
  private socket: Socket | null = null;
  private pending = new Map<string, PendingRequest>();
  private buffer = '';
  private socketPath: string;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private requestTimeoutMs = 30_000;

  constructor(socketPath: string) {
    super();
    this.socketPath = socketPath;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
        return;
      }

      this.socket = createConnection(this.socketPath);

      this.socket.on('connect', () => {
        this.connected = true;
        this.buffer = '';
        console.log('[runtime-client] Connected to agent-runtime');
        resolve();
      });

      this.socket.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.socket = null;
        console.log('[runtime-client] Disconnected from agent-runtime');
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.socket.on('error', (err) => {
        if (!this.connected) {
          reject(err);
          return;
        }
        console.error('[runtime-client] Socket error:', err.message);
      });
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Client disconnected'));
    }
    this.pending.clear();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // -- High-level API --

  async spawnSession(payload: SpawnSessionPayload): Promise<SessionInfo> {
    const response = await this.request({
      type: 'spawn_session',
      id: uuid(),
      payload,
    });
    if (!response.ok) throw new Error(response.error || 'Spawn failed');
    return response.data as SessionInfo;
  }

  async sendPrompt(sessionId: string, prompt: string): Promise<void> {
    const response = await this.request({
      type: 'send_prompt',
      id: uuid(),
      payload: { sessionId, prompt },
    });
    if (!response.ok) throw new Error(response.error || 'Send prompt failed');
  }

  async killSession(sessionId: string): Promise<void> {
    const response = await this.request({
      type: 'kill_session',
      id: uuid(),
      payload: { sessionId },
    });
    if (!response.ok) throw new Error(response.error || 'Kill failed');
  }

  async listSessions(): Promise<SessionInfo[]> {
    const response = await this.request({
      type: 'list_sessions',
      id: uuid(),
    });
    if (!response.ok) throw new Error(response.error || 'List failed');
    return (response.data as SessionInfo[]) || [];
  }

  async writeToSession(sessionId: string, data: string): Promise<void> {
    const response = await this.request({
      type: 'write_to_session',
      id: uuid(),
      payload: { sessionId, data },
    });
    if (!response.ok) throw new Error(response.error || 'Write failed');
  }

  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    const response = await this.request({
      type: 'resize_session',
      id: uuid(),
      payload: { sessionId, cols, rows },
    });
    if (!response.ok) throw new Error(response.error || 'Resize failed');
  }

  async getSessionBuffer(sessionId: string): Promise<string> {
    const response = await this.request({
      type: 'get_session_buffer',
      id: uuid(),
      payload: { sessionId },
    });
    if (!response.ok) throw new Error(response.error || 'Buffer query failed');
    return (response.data as { buffer: string }).buffer;
  }

  async getSessionStatus(sessionId: string): Promise<SessionInfo> {
    const response = await this.request({
      type: 'get_session_status',
      id: uuid(),
      payload: { sessionId },
    });
    if (!response.ok) throw new Error(response.error || 'Status query failed');
    return response.data as SessionInfo;
  }

  // -- Low-level --

  private request(req: RuntimeRequest): Promise<RuntimeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error('Not connected to agent-runtime'));
        return;
      }

      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        reject(new Error(`Request ${req.type} timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      this.pending.set(req.id, { resolve, reject, timer });
      this.socket.write(JSON.stringify(req) + '\n');
    });
  }

  private processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as RuntimeResponse | RuntimeEvent;
        this.handleMessage(msg);
      } catch {
        console.error('[runtime-client] Failed to parse message:', line.slice(0, 200));
      }
    }
  }

  private handleMessage(msg: RuntimeResponse | RuntimeEvent) {
    if (msg.type === 'response') {
      const resp = msg as RuntimeResponse;
      const pending = this.pending.get(resp.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(resp.id);
        pending.resolve(resp);
      }
    } else if (msg.type === 'event') {
      const event = msg as RuntimeEvent;
      this.emit(event.event, event.payload);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        this.scheduleReconnect();
      }
    }, 5000);
  }
}
