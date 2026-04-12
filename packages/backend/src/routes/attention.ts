import type { FastifyInstance } from 'fastify';
import {
  listAttentionItems,
  getPendingCount,
  resolveAttentionItem,
  dismissAttentionItem,
} from '../services/attention-service.js';

export async function attentionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List pending attention items for a project, with optional ?type= filter
  fastify.get<{
    Params: { projectId: string };
    Querystring: { type?: string };
  }>('/api/projects/:projectId/attention', async (request) => {
    const { projectId } = request.params;
    const { type } = request.query;
    return listAttentionItems(projectId, type);
  });

  // Global count of pending attention items across all projects (for badge)
  fastify.get('/api/attention/count', async () => {
    const count = await getPendingCount();
    return { count };
  });

  // Resolve an attention item with optional resolution note
  fastify.post<{
    Params: { id: string };
    Body: { resolutionNote?: string };
  }>('/api/attention/:id/resolve', async (request, reply) => {
    const { id } = request.params;
    const { resolutionNote } = request.body ?? {};
    const userId = request.user.userId;

    const item = await resolveAttentionItem(id, userId, resolutionNote);
    if (!item) return reply.status(404).send({ error: 'Attention item not found' });
    return item;
  });

  // Dismiss an attention item without action
  fastify.post<{
    Params: { id: string };
  }>('/api/attention/:id/dismiss', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.userId;

    const item = await dismissAttentionItem(id, userId);
    if (!item) return reply.status(404).send({ error: 'Attention item not found' });
    return item;
  });
}
