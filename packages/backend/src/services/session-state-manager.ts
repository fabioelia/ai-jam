import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { queueManager } from './queue-manager.js';

export type SessionStatus = 'pending' | 'queued' | 'spawning' | 'running' | 'paused' | 'completed' | 'failed';

export interface SessionStateTransition {
  from: SessionStatus;
  to: SessionStatus;
  timestamp: Date;
  reason?: string;
}

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  pending: ['queued', 'spawning', 'failed'],
  queued: ['spawning', 'failed'],
  spawning: ['running', 'failed'],
  running: ['paused', 'completed', 'failed'],
  paused: ['running', 'failed'],
  completed: [],
  failed: [],
};

export class SessionStateManager {
  private static instance: SessionStateManager;

  private constructor() {}

  static getInstance(): SessionStateManager {
    if (!SessionStateManager.instance) {
      SessionStateManager.instance = new SessionStateManager();
    }
    return SessionStateManager.instance;
  }

  private validateTransition(from: SessionStatus, to: SessionStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  async transitionStatus(
    sessionId: string,
    newStatus: SessionStatus,
    reason?: string,
  ): Promise<void> {
    const [session] = await db.select({
      id: agentSessions.id,
      status: agentSessions.status,
      ticketId: agentSessions.ticketId,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    if (!this.validateTransition(session.status as SessionStatus, newStatus)) {
      throw new Error(
        `Invalid transition from ${session.status} to ${newStatus}`,
      );
    }

    const updates: Record<string, unknown> = {
      status: newStatus,
    };

    if (newStatus === 'spawning') {
      updates.startedAt = new Date();
    } else if (newStatus === 'completed') {
      updates.completedAt = new Date();
      updates.activity = 'idle';
    } else if (newStatus === 'failed') {
      if (!updates.completedAt) {
        updates.completedAt = new Date();
      }
      updates.activity = 'idle';
    }

    await db.update(agentSessions)
      .set(updates)
      .where(eq(agentSessions.id, sessionId));
  }

  async spawnSession(sessionId: string): Promise<void> {
    const [session] = await db.select({
      id: agentSessions.id,
      status: agentSessions.status,
      ticketId: agentSessions.ticketId,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'queued') {
      throw new Error(`Session must be queued to spawn, current status: ${session.status}`);
    }

    await this.transitionStatus(sessionId, 'spawning');
  }

  async startSession(sessionId: string): Promise<void> {
    await this.transitionStatus(sessionId, 'running');
  }

  async pauseSession(sessionId: string, reason?: string): Promise<void> {
    await this.transitionStatus(sessionId, 'paused', reason);
  }

  async resumeSession(sessionId: string): Promise<void> {
    await this.transitionStatus(sessionId, 'running');
  }

  async completeSession(sessionId: string): Promise<void> {
    await this.transitionStatus(sessionId, 'completed');
  }

  async failSession(sessionId: string, reason?: string): Promise<void> {
    await this.transitionStatus(sessionId, 'failed', reason);

    const [session] = await db.select({
      queuePosition: agentSessions.queuePosition,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    if (session?.queuePosition) {
      await queueManager.removeFromQueue(sessionId);
    }
  }

  async getActiveSessions(ticketId?: string): Promise<Array<{
    id: string;
    status: SessionStatus;
    activity: string;
    startedAt: Date | null;
  }>> {
    let whereCondition = inArray(
      agentSessions.status,
      ['spawning', 'running', 'paused'] as const,
    );

    if (ticketId) {
      whereCondition = and(
        whereCondition,
        eq(agentSessions.ticketId, ticketId),
      ) as typeof whereCondition;
    }

    const sessions = await db.select({
      id: agentSessions.id,
      status: agentSessions.status,
      activity: agentSessions.activity,
      startedAt: agentSessions.startedAt,
    })
      .from(agentSessions)
      .where(whereCondition);

    return sessions.map((s) => ({
      id: s.id,
      status: s.status as SessionStatus,
      activity: s.activity,
      startedAt: s.startedAt,
    }));
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus | null> {
    const [session] = await db.select({
      status: agentSessions.status,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    return (session?.status as SessionStatus) ?? null;
  }

  async updateActivity(sessionId: string, activity: string): Promise<void> {
    await db.update(agentSessions)
      .set({ activity })
      .where(eq(agentSessions.id, sessionId));
  }

  async getSessionsByStatus(status: SessionStatus, limit: number = 50): Promise<Array<{
    id: string;
    ticketId: string | null;
    personaType: string;
    activity: string;
    createdAt: Date;
  }>> {
    const sessions = await db.select({
      id: agentSessions.id,
      ticketId: agentSessions.ticketId,
      personaType: agentSessions.personaType,
      activity: agentSessions.activity,
      createdAt: agentSessions.createdAt,
    })
      .from(agentSessions)
      .where(eq(agentSessions.status, status))
      .orderBy(agentSessions.createdAt)
      .limit(limit);

    return sessions;
  }

  async getSessionWithTicket(sessionId: string): Promise<{
    session: typeof agentSessions.$inferSelect;
    ticket: typeof tickets.$inferSelect | null;
  } | null> {
    const [result] = await db.select({
      session: agentSessions,
      ticket: tickets,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.id, sessionId));

    return result ?? null;
  }

  async getQueuedSessionsCount(ticketId?: string): Promise<number> {
    let whereCondition = eq(agentSessions.status, 'queued');

    if (ticketId) {
      whereCondition = and(
        whereCondition,
        eq(agentSessions.ticketId, ticketId),
      ) as typeof whereCondition;
    }

    const [result] = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .where(whereCondition);

    return result.count;
  }
}

import { sql } from 'drizzle-orm';

export const sessionStateManager = SessionStateManager.getInstance();
