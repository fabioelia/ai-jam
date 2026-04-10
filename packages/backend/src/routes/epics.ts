import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { epics } from '../db/schema.js';
import { createEpicSchema, updateEpicSchema } from '@ai-jam/shared';

export async function epicRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List epics for a feature
  fastify.get<{ Params: { featureId: string } }>('/api/features/:featureId/epics', async (request) => {
    return db.select().from(epics).where(eq(epics.featureId, request.params.featureId));
  });

  // Create epic
  fastify.post<{ Params: { featureId: string } }>('/api/features/:featureId/epics', async (request, reply) => {
    const parsed = createEpicSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [epic] = await db.insert(epics).values({
      featureId: request.params.featureId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      color: parsed.data.color || null,
    }).returning();

    return epic;
  });

  // Update epic
  fastify.patch<{ Params: { id: string } }>('/api/epics/:id', async (request, reply) => {
    const parsed = updateEpicSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [epic] = await db.update(epics).set({ ...parsed.data, updatedAt: new Date() }).where(eq(epics.id, request.params.id)).returning();
    if (!epic) return reply.status(404).send({ error: 'Epic not found' });
    return epic;
  });

  // Delete epic
  fastify.delete<{ Params: { id: string } }>('/api/epics/:id', async (request, reply) => {
    const result = await db.delete(epics).where(eq(epics.id, request.params.id)).returning();
    if (result.length === 0) return reply.status(404).send({ error: 'Epic not found' });
    return { ok: true };
  });
}
