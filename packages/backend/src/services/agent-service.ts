import { db } from '../db/connection.js';
import { agentSessions, tickets, features, projects } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { queueManager } from './queue-manager.js';
import { sessionStateManager } from './session-state-manager.js';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';

export interface CreateAgentSessionParams {
  ticketId: string;
  personaType: string;
  model?: string;
  prompt: string;
  workingDirectory?: string;
  userId?: string;
}

export interface SpawnSessionParams {
  sessionId: string;
  sessionType?: 'execution' | 'planning';
  personaType: string;
  model: string;
  prompt: string;
  workingDirectory: string;
  mcpContext?: {
    sessionId: string;
    projectId: string;
    featureId: string;
    ticketId: string;
    userId: string;
    authToken: string;
    apiBaseUrl: string;
    phase: string;
  };
}

export class AgentService {
  private static instance: AgentService;

  private constructor() {}

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  async requestSession(params: CreateAgentSessionParams): Promise<{
    sessionId: string;
    status: string;
    queuePosition?: number;
  }> {
    const { ticketId, personaType, model, prompt, workingDirectory } = params;

    const [ticket] = await db.select({
      id: tickets.id,
      projectId: tickets.projectId,
      featureId: tickets.featureId,
    })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const canStart = await queueManager.canStartSession(ticket.projectId, ticket.featureId ?? undefined);

    const [session] = await db.insert(agentSessions).values({
      ticketId,
      personaType,
      status: canStart ? 'spawning' : 'pending',
      activity: 'idle',
      prompt,
      workingDirectory: workingDirectory || null,
      startedAt: canStart ? new Date() : null,
    }).returning();

    if (!canStart) {
      const queuePosition = await queueManager.enqueue(session.id);

      await sessionStateManager.transitionStatus(session.id, 'queued', 'Concurrency limit reached, session queued');

      return {
        sessionId: session.id,
        status: 'queued',
        queuePosition,
      };
    }

    try {
      await this.spawnSessionInternal({
        sessionId: session.id,
        sessionType: 'execution',
        personaType,
        model: model || 'sonnet',
        prompt,
        workingDirectory: workingDirectory || process.cwd(),
        mcpContext: ticket.featureId && params.userId ? {
          sessionId: session.id,
          projectId: ticket.projectId,
          featureId: ticket.featureId,
          ticketId,
          userId: params.userId,
          authToken: this.generateMcpToken(params.userId),
          apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
          phase: 'execution',
        } : undefined,
      });

      await sessionStateManager.startSession(session.id);

      return {
        sessionId: session.id,
        status: 'spawning',
      };
    } catch (error) {
      await sessionStateManager.failSession(session.id, `Failed to spawn: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private generateMcpToken(userId: string): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '2h' },
    );
  }

  private async spawnSessionInternal(params: SpawnSessionParams): Promise<void> {
    const client = getRuntimeClient();
    if (!client.isConnected) {
      throw new Error('Agent runtime not connected');
    }

    await client.spawnSession({
      sessionId: params.sessionId,
      sessionType: params.sessionType || 'execution',
      personaType: params.personaType,
      model: params.model,
      prompt: params.prompt,
      workingDirectory: params.workingDirectory,
      mcpContext: params.mcpContext,
    });
  }

  async killSession(sessionId: string): Promise<void> {
    const [session] = await db.select({
      status: agentSessions.status,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    const client = getRuntimeClient();
    if (client.isConnected) {
      try {
        await client.killSession(sessionId);
      } catch (error) {
        console.error(`Failed to kill session via runtime: ${error}`);
      }
    }

    await sessionStateManager.failSession(sessionId, 'Session killed by user');
  }

  async pauseSession(sessionId: string): Promise<void> {
    await sessionStateManager.pauseSession(sessionId, 'Paused by user');
  }

  async resumeSession(sessionId: string): Promise<void> {
    const [session] = await db.select({
      status: agentSessions.status,
      ticketId: agentSessions.ticketId,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'paused') {
      throw new Error(`Cannot resume session with status: ${session.status}`);
    }

    await sessionStateManager.resumeSession(sessionId);
  }

  async updateSessionActivity(sessionId: string, activity: string): Promise<void> {
    await sessionStateManager.updateActivity(sessionId, activity);
  }

  async getQueueStatus(sessionId?: string): Promise<{
    position?: number;
    estimatedWait?: number;
  }> {
    if (!sessionId) {
      return {};
    }

    const position = await queueManager.getQueuePosition(sessionId);

    if (position === null) {
      return {};
    }

    const stats = await queueManager.getQueueStats();

    const avgProcessingTimeMs = 5 * 60 * 1000;
    const estimatedWaitMs = (position - 1) * avgProcessingTimeMs;

    return {
      position,
      estimatedWait: estimatedWaitMs,
    };
  }

  async getSessionInfo(sessionId: string): Promise<{
    session: typeof agentSessions.$inferSelect;
    ticket: typeof tickets.$inferSelect | null;
    project: typeof projects.$inferSelect | null;
    feature: typeof features.$inferSelect | null;
  } | null> {
    const [session] = await db.select({
      session: agentSessions,
      ticket: tickets,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.id, sessionId));

    if (!session) {
      return null;
    }

    const project = session.ticket?.projectId
      ? (await db.select().from(projects).where(eq(projects.id, session.ticket.projectId)))[0] ?? null
      : null;

    const feature = session.ticket?.featureId
      ? (await db.select().from(features).where(eq(features.id, session.ticket.featureId)))[0] ?? null
      : null;

    return {
      session: session.session,
      ticket: session.ticket ?? null,
      project,
      feature,
    };
  }

  async getConcurrencyStatus(projectId: string, featureId?: string): Promise<{
    current: number;
    limit: number;
    canStart: boolean;
    queued: number;
  }> {
    const canStart = await queueManager.canStartSession(projectId, featureId);

    const currentResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .where(
        and(
          eq(tickets.projectId, projectId),
          featureId ? eq(tickets.featureId, featureId) : sql`1=1`,
          inArray(agentSessions.status, ['spawning', 'running', 'paused'] as const),
        ),
      )
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id));

    const current = currentResult[0]?.count ?? 0;

    const [project] = await db.select({
      maxConcurrent: projects.maxConcurrentAgents,
    })
      .from(projects)
      .where(eq(projects.id, projectId));

    const projectLimit = project?.maxConcurrentAgents ?? 3;

    let featureLimit: number | null = null;

    if (featureId) {
      const [feature] = await db.select({
        maxConcurrent: features.maxConcurrentAgents,
      })
        .from(features)
        .where(eq(features.id, featureId));

      featureLimit = feature?.maxConcurrentAgents ?? null;
    }

    const limit = featureLimit !== null ? featureLimit : projectLimit;

    const queuedResult = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.status, 'queued'),
          eq(tickets.projectId, projectId),
          featureId ? eq(tickets.featureId, featureId) : sql`1=1`,
        ),
      )
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id));

    const queued = queuedResult[0]?.count ?? 0;

    return {
      current,
      limit,
      canStart,
      queued,
    };
  }
}

import { sql } from 'drizzle-orm';

export const agentService = AgentService.getInstance();
