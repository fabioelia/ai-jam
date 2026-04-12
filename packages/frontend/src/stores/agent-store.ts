import { create } from 'zustand';

export interface AgentSessionInfo {
  sessionId: string;
  ticketId: string | null;
  personaType: string;
  activity: 'busy' | 'waiting' | 'idle';
  status: 'pending' | 'starting' | 'running' | 'completed' | 'failed';
  outputChunks: string[];
  summary: string | null;
}

interface AgentStore {
  sessions: Map<string, AgentSessionInfo>;
  /** Recent activity log entries (newest first) */
  activityLog: ActivityLogEntry[];

  sessionStarted: (sessionId: string, ticketId: string | null, personaType: string) => void;
  sessionActivity: (sessionId: string, activity: 'busy' | 'waiting' | 'idle') => void;
  sessionOutput: (sessionId: string, chunk: string) => void;
  sessionCompleted: (sessionId: string, summary: string | null, failed?: boolean) => void;
  getSessionForTicket: (ticketId: string) => AgentSessionInfo | undefined;
  getLastSessionForTicket: (ticketId: string) => AgentSessionInfo | undefined;
  clearCompleted: () => void;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  personaType: string;
  ticketId: string | null;
  type: 'started' | 'activity' | 'output' | 'completed';
  message: string;
}

let logIdCounter = 0;

export const useAgentStore = create<AgentStore>((set, get) => ({
  sessions: new Map(),
  activityLog: [],

  sessionStarted: (sessionId, ticketId, personaType) => {
    const sessions = new Map(get().sessions);
    sessions.set(sessionId, {
      sessionId,
      ticketId,
      personaType,
      activity: 'busy',
      status: 'running',
      outputChunks: [],
      summary: null,
    });

    const entry: ActivityLogEntry = {
      id: `log-${++logIdCounter}`,
      timestamp: Date.now(),
      sessionId,
      personaType,
      ticketId,
      type: 'started',
      message: `${personaType} started`,
    };

    set({
      sessions,
      activityLog: [entry, ...get().activityLog].slice(0, 200),
    });
  },

  sessionActivity: (sessionId, activity) => {
    const sessions = new Map(get().sessions);
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.set(sessionId, { ...session, activity });
    set({ sessions });
  },

  sessionOutput: (sessionId, chunk) => {
    const sessions = new Map(get().sessions);
    const session = sessions.get(sessionId);
    if (!session) return;
    // Keep last 100 chunks per session
    const outputChunks = [...session.outputChunks, chunk].slice(-100);
    sessions.set(sessionId, { ...session, outputChunks });
    set({ sessions });
  },

  sessionCompleted: (sessionId, summary, failed) => {
    const sessions = new Map(get().sessions);
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.set(sessionId, { ...session, status: failed ? 'failed' : 'completed', activity: 'idle', summary });

    const entry: ActivityLogEntry = {
      id: `log-${++logIdCounter}`,
      timestamp: Date.now(),
      sessionId,
      personaType: session.personaType,
      ticketId: session.ticketId,
      type: 'completed',
      message: summary || `${session.personaType} completed`,
    };

    set({
      sessions,
      activityLog: [entry, ...get().activityLog].slice(0, 200),
    });
  },

  getSessionForTicket: (ticketId) => {
    for (const session of get().sessions.values()) {
      if (session.ticketId === ticketId && (session.status === 'running' || session.status === 'starting')) {
        return session;
      }
    }
    return undefined;
  },

  getLastSessionForTicket: (ticketId) => {
    let latest: AgentSessionInfo | undefined;
    for (const session of get().sessions.values()) {
      if (session.ticketId === ticketId) {
        if (!latest || (session.status === 'running' || session.status === 'starting')) {
          latest = session;
        }
      }
    }
    return latest;
  },

  clearCompleted: () => {
    const sessions = new Map(get().sessions);
    for (const [id, session] of sessions) {
      if (session.status === 'completed' || session.status === 'failed') {
        sessions.delete(id);
      }
    }
    set({ sessions });
  },
}));
