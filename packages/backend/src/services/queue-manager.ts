import { db } from '../db/connection.js';
import { agentSessions, tickets, projects, features } from '../db/schema.js';
import { eq, and, sql, or, inArray } from 'drizzle-orm';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface QueuedSession {
  sessionId: string;
  ticketId: string | null;
  priority: Priority;
  queuedAt: Date;
  queuePosition: number;
}

export interface QueueStats {
  totalQueued: number;
  byPriority: Record<Priority, number>;
  projectQueues: Record<string, { queued: number; capacity: number }>;
  featureQueues: Record<string, { queued: number; capacity: number | null }>;
}

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_VALUE: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class QueueManager {
  private static instance: QueueManager;

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  async enqueue(sessionId: string): Promise<number> {
    const [session] = await db.select({
      id: agentSessions.id,
      ticketId: agentSessions.ticketId,
      projectId: tickets.projectId,
      featureId: tickets.featureId,
      priority: tickets.priority,
      queuedAt: agentSessions.queuedAt,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.ticketId || !session.priority) {
      throw new Error('Session must be associated with a ticket with a priority');
    }

    const now = new Date();

    await db.update(agentSessions)
      .set({
        status: 'queued',
        queuedAt: now,
      })
      .where(eq(agentSessions.id, sessionId));

    const position = await this.calculateQueuePosition(sessionId, session.priority as Priority);

    await db.update(agentSessions)
      .set({ queuePosition: position })
      .where(eq(agentSessions.id, sessionId));

    return position;
  }

  private async calculateQueuePosition(sessionId: string, priority: Priority): Promise<number> {
    const currentPriorityValue = PRIORITY_VALUE[priority];

    const [result] = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(
        and(
          eq(agentSessions.status, 'queued'),
          sql`${PRIORITY_VALUE[sql.raw(`tickets.priority`)]} < ${currentPriorityValue}`,
        ),
      );

    const higherPriorityCount = result.count;

    const [samePriorityResult] = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(
        and(
          eq(agentSessions.status, 'queued'),
          eq(sql`tickets.priority`, priority),
          sql`${agentSessions.queuedAt} < (
            SELECT queued_at FROM agent_sessions WHERE id = ${sessionId}
          )`,
        ),
      );

    const samePriorityEarlierCount = samePriorityResult.count;

    return higherPriorityCount + samePriorityEarlierCount + 1;
  }

  async dequeue(projectId?: string, featureId?: string): Promise<string | null> {
    let conditions = [eq(agentSessions.status, 'queued')];

    if (featureId) {
      const [feature] = await db.select({
        projectId: features.projectId,
      }).from(features).where(eq(features.id, featureId));

      if (feature) {
        conditions.push(eq(tickets.projectId, feature.projectId));
      }
    } else if (projectId) {
      conditions.push(eq(tickets.projectId, projectId));
    }

    const queued = await db.select({
      sessionId: agentSessions.id,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(and(...conditions))
      .orderBy(
        sql`CASE tickets.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END`,
        agentSessions.queuedAt,
      )
      .limit(1);

    if (queued.length === 0) {
      return null;
    }

    const { sessionId } = queued[0];

    await db.update(agentSessions)
      .set({
        status: 'spawning',
        queuePosition: null,
      })
      .where(eq(agentSessions.id, sessionId));

    await this.recalculateQueuePositions();

    return sessionId;
  }

  private async recalculateQueuePositions(): Promise<void> {
    const queuedSessions = await db.select({
      sessionId: agentSessions.id,
      priority: tickets.priority,
      queuedAt: agentSessions.queuedAt,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.status, 'queued'))
      .orderBy(
        sql`CASE tickets.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END`,
        agentSessions.queuedAt,
      );

    for (let i = 0; i < queuedSessions.length; i++) {
      const session = queuedSessions[i];
      await db.update(agentSessions)
        .set({ queuePosition: i + 1 })
        .where(eq(agentSessions.id, session.sessionId));
    }
  }

  async removeFromQueue(sessionId: string): Promise<void> {
    await db.update(agentSessions)
      .set({
        status: 'failed',
        queuePosition: null,
        completedAt: new Date(),
      })
      .where(eq(agentSessions.id, sessionId));

    await this.recalculateQueuePositions();
  }

  async getQueuePosition(sessionId: string): Promise<number | null> {
    const [session] = await db.select({
      queuePosition: agentSessions.queuePosition,
    })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));

    return session?.queuePosition ?? null;
  }

  async canStartSession(projectId: string, featureId?: string): Promise<boolean> {
    const currentCount = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .where(
        and(
          inArray(agentSessions.status, ['spawning', 'running', 'paused']),
          eq(tickets.projectId, projectId),
        ),
      )
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id));

    const totalRunning = currentCount[0].count;

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

    if (totalRunning >= projectLimit) {
      return false;
    }

    if (featureLimit !== null) {
      const featureCount = await db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(agentSessions)
        .where(
          and(
            inArray(agentSessions.status, ['spawning', 'running', 'paused']),
            eq(tickets.projectId, projectId),
            eq(tickets.featureId, featureId!),
          ),
        )
        .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id));

      const featureRunning = featureCount[0].count;

      if (featureRunning >= featureLimit) {
        return false;
      }
    }

    return true;
  }

  async getQueueStats(projectId?: string, featureId?: string): Promise<QueueStats> {
    let whereClause = eq(agentSessions.status, 'queued');

    if (featureId) {
      whereClause = and(
        whereClause,
        eq(tickets.projectId, sql`(SELECT project_id FROM features WHERE id = ${featureId})`),
      ) as typeof whereClause;
    } else if (projectId) {
      whereClause = and(whereClause, eq(tickets.projectId, projectId)) as typeof whereClause;
    }

    const [totalQueued] = await db.select({
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(whereClause);

    const byPriority: Record<Priority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const priority of PRIORITY_ORDER) {
      const [count] = await db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(agentSessions)
        .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
        .where(
          and(
            eq(agentSessions.status, 'queued'),
            eq(tickets.priority, priority),
            featureId
              ? eq(tickets.projectId, sql`(SELECT project_id FROM features WHERE id = ${featureId})`)
              : projectId
                ? eq(tickets.projectId, projectId)
                : sql`1=1`,
          ),
        );

      byPriority[priority] = count.count;
    }

    const projectQueues: Record<string, { queued: number; capacity: number }> = {};

    const projectIds = await db.select({
      projectId: tickets.projectId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.status, 'queued'))
      .groupBy(tickets.projectId);

    for (const { projectId: pid, count } of projectIds) {
      if (!pid) continue;

      const [project] = await db.select({
        maxConcurrent: projects.maxConcurrentAgents,
      })
        .from(projects)
        .where(eq(projects.id, pid));

      projectQueues[pid] = {
        queued: count,
        capacity: project?.maxConcurrentAgents ?? 3,
      };
    }

    const featureQueues: Record<string, { queued: number; capacity: number | null }> = {};

    if (featureId || projectId) {
      const featureIds = await db.select({
        featureId: tickets.featureId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(agentSessions)
        .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
        .where(
          and(
            eq(agentSessions.status, 'queued'),
            projectId ? eq(tickets.projectId, projectId) : sql`1=1`,
          ),
        )
        .groupBy(tickets.featureId);

      for (const { featureId: fid, count } of featureIds) {
        if (!fid) continue;

        const [feature] = await db.select({
          maxConcurrent: features.maxConcurrentAgents,
        })
          .from(features)
          .where(eq(features.id, fid));

        featureQueues[fid] = {
          queued: count,
          capacity: feature?.maxConcurrentAgents ?? null,
        };
      }
    }

    return {
      totalQueued: totalQueued.count,
      byPriority,
      projectQueues,
      featureQueues,
    };
  }

  async getQueuedSessions(limit: number = 50, offset: number = 0): Promise<QueuedSession[]> {
    const sessions = await db.select({
      sessionId: agentSessions.id,
      ticketId: agentSessions.ticketId,
      priority: tickets.priority,
      queuedAt: agentSessions.queuedAt,
      queuePosition: agentSessions.queuePosition,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.status, 'queued'))
      .orderBy(
        sql`CASE tickets.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END`,
        agentSessions.queuedAt,
      )
      .limit(limit)
      .offset(offset);

    return sessions.map((s) => ({
      sessionId: s.sessionId,
      ticketId: s.ticketId,
      priority: (s.priority ?? 'medium') as Priority,
      queuedAt: s.queuedAt!,
      queuePosition: s.queuePosition!,
    }));
  }
}

export const queueManager = QueueManager.getInstance();
