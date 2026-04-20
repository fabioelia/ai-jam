import { FastifyInstance } from 'fastify';
import { analyzeContextSwitchCost } from '../services/agent-context-switch-service.js';

export async function agentContextSwitchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-context-switch', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeContextSwitchCost(projectId);
  });
}
