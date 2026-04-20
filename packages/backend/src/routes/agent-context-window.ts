import { FastifyInstance } from 'fastify';
import { analyzeAgentContextWindowUtilization } from '../services/agent-context-window-service.js';

export async function agentContextWindowRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-context-window-utilization', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentContextWindowUtilization(projectId);
  });
}
