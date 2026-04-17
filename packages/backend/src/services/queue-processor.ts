import { db } from '../db/connection.js';
import { agentSessions, tickets, features, projects } from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { queueManager } from './queue-manager.js';
import { sessionStateManager } from './session-state-manager.js';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';
import { broadcastToBoard } from '../websocket/socket-server.js';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const PROCESS_INTERVAL_MS = 10_000; // Check every 10 seconds
const MAX_RETRIES = 3;
const SPAWN_TIMEOUT_MS = 30_000; // 30 seconds to spawn

interface ProcessingContext {
  sessionId: string;
  projectId: string;
  featureId: string | null;
  personaType: string;
  prompt: string;
  workingDirectory: string | null;
  priority: string;
  retries: number;
}

let processorTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

const activeSpawns = new Map<string, {
  startedAt: number;
  promise: Promise<void>;
}>();

export class QueueProcessor {
  private static instance: QueueProcessor;

  private constructor() {}

  static getInstance(): QueueProcessor {
    if (!QueueProcessor.instance) {
      QueueProcessor.instance = new QueueProcessor();
    }
    return QueueProcessor.instance;
  }

  start(): void {
    if (processorTimer) {
      console.log('[queue-processor] Already running');
      return;
    }

    console.log('[queue-processor] Starting queue processor');
    processorTimer = setInterval(() => {
      this.processQueue().catch((err) => {
        console.error('[queue-processor] Error processing queue:', err);
      });
    }, PROCESS_INTERVAL_MS);

    // Initial processing
    setImmediate(() => {
      this.processQueue().catch((err) => {
        console.error('[queue-processor] Initial process error:', err);
      });
    });
  }

  stop(): void {
    if (processorTimer) {
      clearInterval(processorTimer);
      processorTimer = null;
      console.log('[queue-processor] Stopped');
    }
  }

  private async processQueue(): Promise<void> {
    if (isProcessing) {
      console.log('[queue-processor] Already processing, skipping cycle');
      return;
    }

    isProcessing = true;

    try {
      // Clean up timed-out spawns
      this.cleanupTimedOutSpawns();

      // Get all projects with queued sessions
      const projectsWithQueues = await this.getProjectsWithQueuedSessions();

      for (const { projectId } of projectsWithQueues) {
        await this.processProjectQueue(projectId);
      }
    } catch (err) {
      console.error('[queue-processor] Error in processQueue:', err);
    } finally {
      isProcessing = false;
    }
  }

  private async getProjectsWithQueuedSessions(): Promise<Array<{ projectId: string }>> {
    const result = await db.select({
      projectId: tickets.projectId,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(eq(agentSessions.status, 'queued'))
      .groupBy(tickets.projectId);

    return result.filter((r) => r.projectId).map((r) => ({ projectId: r.projectId! }));
  }

  private async processProjectQueue(projectId: string): Promise<void> {
    try {
      // Get project-level concurrency limit
      const [project] = await db.select({
        maxConcurrent: projects.maxConcurrentAgents,
      }).from(projects).where(eq(projects.id, projectId));

      const projectLimit = project?.maxConcurrentAgents ?? 3;

      // Count currently running sessions for this project
      const [runningCount] = await db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(agentSessions)
        .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
        .where(
          and(
            eq(tickets.projectId, projectId),
            inArray(agentSessions.status, ['spawning', 'running', 'paused']),
          ),
        );

      const availableSlots = projectLimit - runningCount.count;

      if (availableSlots <= 0) {
        return; // No capacity
      }

      // Check feature-level queues first (they have stricter limits)
      const featuresWithQueues = await db.select({
        featureId: tickets.featureId,
      })
        .from(agentSessions)
        .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
        .where(
          and(
            eq(agentSessions.status, 'queued'),
            eq(tickets.projectId, projectId),
          ),
        )
        .groupBy(tickets.featureId);

      for (const { featureId } of featuresWithQueues) {
        if (!featureId) continue;

        await this.processFeatureQueue(projectId, featureId);
      }

      // Process project-level queue for sessions without feature limits
      const queuedSessions = await this.getQueuedSessionsForProject(projectId);

      for (const session of queuedSessions) {
        if (activeSpawns.has(session.sessionId)) {
          continue; // Already spawning
        }

        // Check if this session is covered by a feature limit
        const sessionFeature = session.ticketId
          ? (await db.select({ featureId: tickets.featureId }).from(tickets).where(eq(tickets.id, session.ticketId)))[0]
          : null;

        if (sessionFeature?.featureId) {
          continue; // Feature-level queues are handled separately
        }

        const spawned = await this.trySpawnSession(session);
        if (!spawned) {
          break; // No more capacity
        }
      }
    } catch (err) {
      console.error(`[queue-processor] Error processing project ${projectId}:`, err);
    }
  }

  private async processFeatureQueue(projectId: string, featureId: string): Promise<void> {
    try {
      // Get feature-level concurrency limit
      const [feature] = await db.select({
        maxConcurrent: features.maxConcurrentAgents,
        projectId: features.projectId,
      }).from(features).where(eq(features.id, featureId));

      const featureLimit = feature?.maxConcurrentAgents;
      if (!featureLimit) {
        return; // No feature limit, handled by project queue
      }

      // Count currently running sessions for this feature
      const [runningCount] = await db.select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
        .from(agentSessions)
        .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
        .where(
          and(
            eq(tickets.featureId, featureId),
            inArray(agentSessions.status, ['spawning', 'running', 'paused']),
          ),
        );

      const availableSlots = featureLimit - runningCount.count;

      if (availableSlots <= 0) {
        return;
      }

      // Get queued sessions for this feature
      const queuedSessions = await this.getQueuedSessionsForFeature(featureId);

      for (const session of queuedSessions) {
        if (activeSpawns.has(session.sessionId)) {
          continue;
        }

        const spawned = await this.trySpawnSession(session);
        if (!spawned) {
          break;
        }
      }
    } catch (err) {
      console.error(`[queue-processor] Error processing feature ${featureId}:`, err);
    }
  }

  private async getQueuedSessionsForProject(projectId: string): Promise<ProcessingContext[]> {
    const sessions = await db.select({
      sessionId: agentSessions.id,
      ticketId: agentSessions.ticketId,
      personaType: agentSessions.personaType,
      prompt: agentSessions.prompt,
      workingDirectory: agentSessions.workingDirectory,
      priority: tickets.priority,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(
        and(
          eq(agentSessions.status, 'queued'),
          eq(tickets.projectId, projectId),
        ),
      )
      .orderBy(
        sql`CASE tickets.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END`,
        agentSessions.queuedAt,
      );

    return sessions.map((s) => ({
      sessionId: s.sessionId,
      projectId: projectId,
      featureId: null,
      personaType: s.personaType,
      prompt: s.prompt,
      workingDirectory: s.workingDirectory,
      priority: s.priority ?? 'medium',
      retries: 0,
    }));
  }

  private async getQueuedSessionsForFeature(featureId: string): Promise<ProcessingContext[]> {
    const sessions = await db.select({
      sessionId: agentSessions.id,
      ticketId: agentSessions.ticketId,
      personaType: agentSessions.personaType,
      prompt: agentSessions.prompt,
      workingDirectory: agentSessions.workingDirectory,
      priority: tickets.priority,
      projectId: tickets.projectId,
    })
      .from(agentSessions)
      .leftJoin(tickets, eq(agentSessions.ticketId, tickets.id))
      .where(
        and(
          eq(agentSessions.status, 'queued'),
          eq(tickets.featureId, featureId),
        ),
      )
      .orderBy(
        sql`CASE tickets.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END`,
        agentSessions.queuedAt,
      );

    return sessions.map((s) => ({
      sessionId: s.sessionId,
      projectId: s.projectId,
      featureId: featureId,
      personaType: s.personaType,
      prompt: s.prompt,
      workingDirectory: s.workingDirectory,
      priority: s.priority ?? 'medium',
      retries: 0,
    }));
  }

  private async trySpawnSession(session: ProcessingContext): Promise<boolean> {
    // Check capacity again before spawning
    const canStart = await queueManager.canStartSession(session.projectId, session.featureId ?? undefined);
    if (!canStart) {
      return false;
    }

    // Dequeue the session
    const dequeuedId = await queueManager.dequeue(session.projectId, session.featureId ?? undefined);
    if (!dequeuedId || dequeuedId !== session.sessionId) {
      console.log(`[queue-processor] Session ${session.sessionId.slice(0, 8)} not dequeued, skipping`);
      return false;
    }

    // Mark as spawning
    await sessionStateManager.transitionStatus(session.sessionId, 'spawning', 'Dequeued by queue processor');

    // Spawn in background
    const spawnPromise = this.spawnSession(session);
    activeSpawns.set(session.sessionId, {
      startedAt: Date.now(),
      promise: spawnPromise,
    });

    // Remove from tracking when done
    spawnPromise.finally(() => {
      activeSpawns.delete(session.sessionId);
    });

    return true;
  }

  private async spawnSession(session: ProcessingContext): Promise<void> {
    try {
      const client = getRuntimeClient();
      if (!client.isConnected) {
        throw new Error('Runtime not connected');
      }

      // Get ticket for MCP context
      const ticket = session.ticketId
        ? (await db.select().from(tickets).where(eq(tickets.id, session.ticketId)))[0]
        : null;

      // Generate service token for MCP
      const mcpToken = jwt.sign(
        { userId: 'system', email: 'system@ai-jam.local' },
        config.jwtSecret,
        { expiresIn: '2h' },
      );

      await client.spawnSession({
        sessionId: session.sessionId,
        sessionType: 'execution',
        personaType: session.personaType,
        model: 'sonnet',
        prompt: session.prompt || '',
        workingDirectory: session.workingDirectory || process.cwd(),
        mcpContext: ticket ? {
          sessionId: session.sessionId,
          projectId: ticket.projectId,
          featureId: ticket.featureId || undefined,
          ticketId: session.ticketId,
          userId: 'system',
          authToken: mcpToken,
          apiBaseUrl: `http://localhost:${config.port}`,
          phase: 'execution',
        } : undefined,
      });

      console.log(`[queue-processor] Spawned session ${session.sessionId.slice(0, 8)} (${session.personaType})`);

      // Broadcast queue position updates to others
      await this.broadcastQueueUpdates(session.projectId, session.featureId ?? undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[queue-processor] Failed to spawn session ${session.sessionId.slice(0, 8)}:`, message);

      await sessionStateManager.failSession(session.sessionId, `Failed to spawn: ${message}`);

      // Re-queue if retryable
      if (session.retries < MAX_RETRIES) {
        session.retries++;
        console.log(`[queue-processor] Re-queueing session ${session.sessionId.slice(0, 8)} (attempt ${session.retries}/${MAX_RETRIES})`);

        const [originalSession] = await db.select().from(agentSessions).where(eq(agentSessions.id, session.sessionId));
        if (originalSession) {
          await queueManager.enqueue(session.sessionId);
          await sessionStateManager.transitionStatus(session.sessionId, 'queued', `Retry ${session.retries}/${MAX_RETRIES}`);
        }
      }
    }
  }

  private cleanupTimedOutSpawns(): void {
    const now = Date.now();

    for (const [sessionId, { startedAt, promise }] of activeSpawns.entries()) {
      if (now - startedAt > SPAWN_TIMEOUT_MS) {
        console.warn(`[queue-processor] Spawn timeout for ${sessionId.slice(0, 8)}`);
        activeSpawns.delete(sessionId);
      }
    }
  }

  private async broadcastQueueUpdates(projectId: string, featureId?: string): Promise<void> {
    try {
      const stats = await queueManager.getQueueStats(projectId, featureId);

      broadcastToBoard(projectId, 'queue:updated', {
        projectId,
        featureId,
        totalQueued: stats.totalQueued,
        byPriority: stats.byPriority,
      });
    } catch (err) {
      console.error('[queue-processor] Failed to broadcast queue updates:', err);
    }
  }

  async manualTrigger(projectId?: string, featureId?: string): Promise<number> {
    console.log(`[queue-processor] Manual trigger: projectId=${projectId}, featureId=${featureId}`);

    if (projectId) {
      if (featureId) {
        await this.processFeatureQueue(projectId, featureId);
      } else {
        await this.processProjectQueue(projectId);
      }
    } else {
      await this.processQueue();
    }

    return activeSpawns.size;
  }

  async pauseProcessing(): Promise<void> {
    isProcessing = true;
    console.log('[queue-processor] Processing paused');
  }

  async resumeProcessing(): Promise<void> {
    isProcessing = false;
    console.log('[queue-processor] Processing resumed');
  }

  getStats(): { activeSpawns: number; isProcessing: boolean } {
    return {
      activeSpawns: activeSpawns.size,
      isProcessing,
    };
  }
}

export const queueProcessor = QueueProcessor.getInstance();

export function startQueueProcessor(): void {
  queueProcessor.start();
}

export function stopQueueProcessor(): void {
  queueProcessor.stop();
}
