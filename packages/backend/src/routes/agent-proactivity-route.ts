import { FastifyInstance } from 'fastify';
import { analyzeAgentProactivity } from '../services/agent-proactivity-service.js';

export async function agentProactivityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-proactivity', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentProactivity(projectId);
  });
}
