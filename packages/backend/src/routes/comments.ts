import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { comments } from '../db/schema.js';
import { createCommentSchema } from '@ai-jam/shared';
import { broadcastToTicket } from '../websocket/socket-server.js';

export async function commentRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List comments for a ticket
  fastify.get<{ Params: { ticketId: string } }>('/api/tickets/:ticketId/comments', async (request) => {
    return db.select().from(comments).where(eq(comments.ticketId, request.params.ticketId));
  });

  // Create comment
  fastify.post<{ Params: { ticketId: string } }>('/api/tickets/:ticketId/comments', async (request, reply) => {
    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { userId } = request.user;
    const [comment] = await db.insert(comments).values({
      ticketId: request.params.ticketId,
      userId,
      body: parsed.data.body,
    }).returning();

    broadcastToTicket(request.params.ticketId, 'comment:created', { comment });
    return comment;
  });

  // Update comment
  fastify.patch<{ Params: { id: string } }>('/api/comments/:id', async (request, reply) => {
    const { body } = request.body as { body?: string };
    if (!body) return reply.status(400).send({ error: 'body is required' });

    const [comment] = await db.update(comments).set({ body, updatedAt: new Date() }).where(eq(comments.id, request.params.id)).returning();
    if (!comment) return reply.status(404).send({ error: 'Comment not found' });
    return comment;
  });

  // Delete comment
  fastify.delete<{ Params: { id: string } }>('/api/comments/:id', async (request, reply) => {
    const result = await db.delete(comments).where(eq(comments.id, request.params.id)).returning();
    if (result.length === 0) return reply.status(404).send({ error: 'Comment not found' });
    return { ok: true };
  });
}
