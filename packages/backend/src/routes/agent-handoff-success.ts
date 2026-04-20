import { FastifyInstance } from 'fastify';
import { analyzeHandoffSuccess } from '../services/agent-handoff-success-service.js';

export async function agentHandoffSuccessRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-handoff-success', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeHandoffSuccess(projectId);
  });
}
