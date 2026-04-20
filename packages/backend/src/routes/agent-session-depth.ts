import { FastifyInstance } from 'fastify';
import { analyzeSessionDepth } from '../services/agent-session-depth-service.js';

export async function agentSessionDepthRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-session-depth', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeSessionDepth(projectId);
  });
}
