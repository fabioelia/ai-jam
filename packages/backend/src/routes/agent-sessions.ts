import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { getRuntimeClient, retrySession } from '../agent-runtime/runtime-manager.js';
import { v4 as uuid } from 'uuid';

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
  fastify.post<{
    Body: {
      ticketId: string;
      personaType: string;
      model?: string;
      prompt: string;
      workingDirectory?: string;
    };
  }>('/api/agent-sessions', async (request, reply) => {
    const { ticketId, personaType, model, prompt, workingDirectory } = request.body;

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

    // Spawn via runtime client
    const client = getRuntimeClient();
    if (!client.isConnected) {
      return reply.status(503).send({ error: 'Agent runtime not connected' });
    }

    try {
      await client.spawnSession({
        sessionId,
        personaType,
        model: model || 'sonnet',
        prompt,
        workingDirectory: workingDirectory || process.cwd(),
      });
    } catch (err) {
      // Update DB to failed
      await db.update(agentSessions)
        .set({ status: 'failed' })
        .where(eq(agentSessions.id, sessionId));

      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: `Failed to spawn agent: ${message}` });
    }

    return session;
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
}
