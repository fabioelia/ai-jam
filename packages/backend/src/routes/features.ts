import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { features } from '../db/schema.js';
import { createFeatureSchema } from '@ai-jam/shared';

export async function featureRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List features for a project
  fastify.get<{ Params: { projectId: string } }>('/api/projects/:projectId/features', async (request) => {
    return db.select().from(features).where(eq(features.projectId, request.params.projectId));
  });

  // Create feature
  fastify.post<{ Params: { projectId: string } }>('/api/projects/:projectId/features', async (request, reply) => {
    const parsed = createFeatureSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { userId } = request.user;
    const [feature] = await db.insert(features).values({
      projectId: request.params.projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      repoBranch: parsed.data.repoBranch || null,
      createdBy: userId,
    }).returning();

    return feature;
  });

  // Get single feature
  fastify.get<{ Params: { id: string } }>('/api/features/:id', async (request, reply) => {
    const [feature] = await db.select().from(features).where(eq(features.id, request.params.id)).limit(1);
    if (!feature) return reply.status(404).send({ error: 'Feature not found' });
    return feature;
  });

  // Update feature
  fastify.patch<{ Params: { id: string } }>('/api/features/:id', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof body.title === 'string') updates.title = body.title;
    if (typeof body.description === 'string') updates.description = body.description;
    if (typeof body.status === 'string') updates.status = body.status;

    const [feature] = await db.update(features).set({ ...updates, updatedAt: new Date() }).where(eq(features.id, request.params.id)).returning();
    if (!feature) return reply.status(404).send({ error: 'Feature not found' });
    return feature;
  });
}
