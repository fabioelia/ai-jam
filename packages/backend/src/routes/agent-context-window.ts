import { FastifyInstance } from 'fastify';
import { analyzeAgentContextWindow } from '../services/agent-context-window-service.js';

export async function agentContextWindowRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-context-window', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentContextWindow(projectId);
  });
}
