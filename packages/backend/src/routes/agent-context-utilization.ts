import { FastifyInstance } from 'fastify';
import { analyzeContextUtilization } from '../services/agent-context-utilization-service.js';

export async function agentContextUtilizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-context-utilization', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeContextUtilization(projectId);
  });
}
