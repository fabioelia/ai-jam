import type { FastifyInstance } from 'fastify';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { agentSessions, tickets, features, projects } from '../db/schema.js';
import { config } from '../config.js';
import { getRuntimeClient, retrySession } from '../agent-runtime/runtime-manager.js';
import { v4 as uuid } from 'uuid';
import { agentService } from '../services/agent-service.js';
import { queueManager } from '../services/queue-manager.js';
import { sessionStateManager } from '../services/session-state-manager.js';
import { queueProcessor } from '../services/queue-processor.js';

export async function agentSessionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List agent sessions (with optional filters)
  fastify.get<{
    Querystring: { ticketId?: string; status?: string; personaType?: string };
  }>('/api/agent-sessions', async (request) => {
    const { ticketId, status, personaType } = request.query;

    let query = db.select().from(agentSessions).orderBy(desc(agentSessions.createdAt));

    const conditions = [];
    if (ticketId) conditions.push(eq(agentSessions.ticketId, ticketId));
    if (status) conditions.push(eq(agentSessions.status, status));
    if (personaType) conditions.push(eq(agentSessions.personaType, personaType));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return query.limit(50);
  });

  // Get single agent session
  fastify.get<{ Params: { id: string } }>('/api/agent-sessions/:id', async (request, reply) => {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, request.params.id));
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return session;
  });

  // Spawn a new agent session
  // Pass skipSpawn: true to only create the DB record (used by the orchestrator
  // which spawns sessions itself via the session manager).
  // Pass checkQueue: false to bypass queue checking (for internal use).
  fastify.post<{
    Body: {
      ticketId: string;
      personaType: string;
      model?: string;
      prompt: string;
      workingDirectory?: string;
      skipSpawn?: boolean;
      checkQueue?: boolean;
    };
  }>('/api/agent-sessions', async (request, reply) => {
    const { ticketId, personaType, model, prompt, workingDirectory, skipSpawn, checkQueue = true } = request.body;

    // Verify ticket exists
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

    const sessionId = uuid();

    // Create DB record
    const [session] = await db.insert(agentSessions).values({
      id: sessionId,
      ticketId,
      personaType,
      status: 'pending',
      activity: 'idle',
      prompt,
      workingDirectory: workingDirectory || null,
    }).returning();

    // When skipSpawn is true, just return the DB record without spawning.
    // The caller (e.g. orchestrator) is responsible for spawning the session.
    if (skipSpawn) {
      return session;
    }

    // Check queue if enabled
    if (checkQueue) {
      const canStart = await queueManager.canStartSession(ticket.projectId, ticket.featureId ?? undefined);

      if (!canStart) {
        // Queue the session
        const queuePosition = await queueManager.enqueue(sessionId);
        await sessionStateManager.transitionStatus(sessionId, 'queued', 'Concurrency limit reached, session queued');

        // Return updated session
        const [updatedSession] = await db.select().from(agentSessions).where(eq(agentSessions.id, sessionId));
        return { ...updatedSession, queuePosition };
      }
    }

    // Spawn via runtime client
    const client = getRuntimeClient();
    if (!client.isConnected) {
      // If we can't spawn, queue the session instead
      if (checkQueue) {
        const queuePosition = await queueManager.enqueue(sessionId);
        await sessionStateManager.transitionStatus(sessionId, 'queued', 'Runtime not connected, session queued');

        const [updatedSession] = await db.select().from(agentSessions).where(eq(agentSessions.id, sessionId));
        return { ...updatedSession, queuePosition };
      }
      return reply.status(503).send({ error: 'Agent runtime not connected' });
    }

    try {
      // Update status to spawning
      await sessionStateManager.transitionStatus(sessionId, 'spawning');

      // Look up feature for MCP context
      let featureId: string | undefined;
      if (ticket.featureId) {
        featureId = ticket.featureId;
      }

      // Generate a long-lived token for the MCP server
      const { userId } = request.user;
      const mcpToken = jwt.sign(
        { userId, email: request.user.email },
        config.jwtSecret,
        { expiresIn: '2h' },
      );

      await client.spawnSession({
        sessionId,
        sessionType: 'execution',
        personaType,
        model: model || 'sonnet',
        prompt,
        workingDirectory: workingDirectory || process.cwd(),
        mcpContext: featureId ? {
          sessionId,
          projectId: ticket.projectId,
          featureId,
          ticketId,
          userId,
          authToken: mcpToken,
          apiBaseUrl: `http://localhost:${config.port}`,
          phase: 'execution',
        } : undefined,
      });
    } catch (err) {
      // Update DB to failed
      await sessionStateManager.failSession(sessionId, `Failed to spawn agent: ${err instanceof Error ? err.message : String(err)}`);

      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Failed to spawn agent: ${message}` });
    }

    const [updatedSession] = await db.select().from(agentSessions).where(eq(agentSessions.id, sessionId));
    return updatedSession;
  });

  // Kill an agent session
  fastify.delete<{ Params: { id: string } }>('/api/agent-sessions/:id', async (request, reply) => {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, request.params.id));
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const client = getRuntimeClient();
    if (client.isConnected) {
      try {
        await client.killSession(request.params.id);
      } catch {
        // Runtime might not know about this session
      }
    }

    await db.update(agentSessions)
      .set({ status: 'failed', activity: 'idle', completedAt: new Date() })
      .where(eq(agentSessions.id, request.params.id));

    return { ok: true };
  });

  // Retry a failed session
  fastify.post<{ Params: { id: string } }>('/api/agent-sessions/:id/retry', async (request, reply) => {
    try {
      const newSessionId = await retrySession(request.params.id);
      return { ok: true, newSessionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Get live session status from runtime (bypasses DB)
  fastify.get<{ Params: { id: string } }>('/api/agent-sessions/:id/live', async (request, reply) => {
    const client = getRuntimeClient();
    if (!client.isConnected) {
      return reply.status(503).send({ error: 'Agent runtime not connected' });
    }

    try {
      const status = await client.getSessionStatus(request.params.id);
      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(404).send({ error: message });
    }
  });

  // Get queue status for a specific session
  fastify.get<{ Params: { id: string } }>('/api/agent-sessions/:id/queue-status', async (request, reply) => {
    const { id } = request.params;
    const status = await agentService.getQueueStatus(id);
    return status;
  });

  // Get global queue statistics
  fastify.get<{
    Querystring: { projectId?: string; featureId?: string };
  }>('/api/agent-sessions/queue/stats', async (request) => {
    const { projectId, featureId } = request.query;

    let actualProjectId = projectId;
    let actualFeatureId = featureId;

    if (featureId && !projectId) {
      const [feature] = await db.select({
        projectId: features.projectId,
      }).from(features).where(eq(features.id, featureId));

      actualProjectId = feature?.projectId;
    }

    const stats = await queueManager.getQueueStats(actualProjectId, actualFeatureId);
    return stats;
  });

  // Get queued sessions list
  fastify.get<{
    Querystring: { limit?: number; offset?: number };
  }>('/api/agent-sessions/queue', async (request) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
    const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;

    const sessions = await queueManager.getQueuedSessions(limit, offset);
    return sessions;
  });

  // Pause a running session
  fastify.post<{ Params: { id: string } }>('/api/agent-sessions/:id/pause', async (request, reply) => {
    try {
      await agentService.pauseSession(request.params.id);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Resume a paused session
  fastify.post<{ Params: { id: string } }>('/api/agent-sessions/:id/resume', async (request, reply) => {
    try {
      await agentService.resumeSession(request.params.id);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Update session activity
  fastify.patch<{ Params: { id: string }; Body: { activity: string } }>('/api/agent-sessions/:id/activity', async (request, reply) => {
    try {
      const { activity } = request.body;
      await agentService.updateSessionActivity(request.params.id, activity);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Get concurrency status
  fastify.get<{
    Querystring: { projectId?: string; featureId?: string };
  }>('/api/agent-sessions/concurrency', async (request, reply) => {
    const { projectId, featureId } = request.query;

    if (!projectId && !featureId) {
      return reply.status(400).send({ error: 'Either projectId or featureId is required' });
    }

    let actualProjectId = projectId;
    let actualFeatureId = featureId;

    if (featureId && !projectId) {
      const [feature] = await db.select({
        projectId: features.projectId,
      }).from(features).where(eq(features.id, featureId));

      actualProjectId = feature?.projectId;
    }

    if (!actualProjectId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const status = await agentService.getConcurrencyStatus(actualProjectId, actualFeatureId);
    return status;
  });

  // Request a new session with automatic queue handling
  fastify.post<{
    Body: {
      ticketId: string;
      personaType: string;
      model?: string;
      prompt: string;
      workingDirectory?: string;
    };
  }>('/api/agent-sessions/request', async (request, reply) => {
    const { ticketId, personaType, model, prompt, workingDirectory } = request.body;

    try {
      const { userId } = request.user;

      const result = await agentService.requestSession({
        ticketId,
        personaType,
        model,
        prompt,
        workingDirectory,
        userId,
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Update session status (admin/internal use)
  fastify.patch<{ Params: { id: string }; Body: { status: 'spawning' | 'running' | 'paused' | 'completed' | 'failed'; reason?: string } }>('/api/agent-sessions/:id/status', async (request, reply) => {
    try {
      const { status, reason } = request.body;

      await sessionStateManager.transitionStatus(request.params.id, status, reason);

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Dequeue next session from queue (internal use by queue processor)
  fastify.post<{
    Querystring: { projectId?: string; featureId?: string };
  }>('/api/agent-sessions/queue/dequeue', async (request) => {
    const { projectId, featureId } = request.query;

    let actualProjectId = projectId;
    let actualFeatureId = featureId;

    if (featureId && !projectId) {
      const [feature] = await db.select({
        projectId: features.projectId,
      }).from(features).where(eq(features.id, featureId));

      actualProjectId = feature?.projectId;
    }

    const sessionId = await queueManager.dequeue(actualProjectId, actualFeatureId);

    return { sessionId };
  });

  // Remove session from queue (cancel queued session)
  fastify.delete<{ Params: { id: string } }>('/api/agent-sessions/:id/queue', async (request, reply) => {
    try {
      const session = await sessionStateManager.getSessionWithTicket(request.params.id);

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      if (session.session.status !== 'queued') {
        return reply.status(400).send({ error: 'Session is not queued' });
      }

      await queueManager.removeFromQueue(request.params.id);
      await sessionStateManager.failSession(request.params.id, 'Removed from queue by user');

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: message });
    }
  });

  // Get active sessions for a ticket
  fastify.get<{ Querystring: { ticketId: string } }>('/api/agent-sessions/active', async (request, reply) => {
    const { ticketId } = request.query;

    if (!ticketId) {
      return reply.status(400).send({ error: 'ticketId is required' });
    }

    try {
      const sessions = await sessionStateManager.getActiveSessions(ticketId);
      return sessions;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: message });
    }
  });

  // Queue processor management routes (admin/internal)

  // Trigger queue processor manually (for testing or immediate processing)
  fastify.post<{
    Querystring: { projectId?: string; featureId?: string };
  }>('/api/agent-sessions/queue/process', async (request) => {
    const { projectId, featureId } = request.query;

    try {
      const activeSpawns = await queueProcessor.manualTrigger(projectId, featureId);
      return { ok: true, activeSpawns };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: message });
    }
  });

  // Get queue processor stats
  fastify.get('/api/agent-sessions/queue/processor-stats', async () => {
    return queueProcessor.getStats();
  });

  // Pause queue processing
  fastify.post('/api/agent-sessions/queue/pause', async () => {
    await queueProcessor.pauseProcessing();
    return { ok: true };
  });

  // Resume queue processing
  fastify.post('/api/agent-sessions/queue/resume', async () => {
    await queueProcessor.resumeProcessing();
    return { ok: true };
  });
}
