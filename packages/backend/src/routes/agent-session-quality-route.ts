import { FastifyInstance } from 'fastify';
import { analyzeAgentSessionQuality } from '../services/agent-session-quality-service.js';

export async function agentSessionQualityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-session-quality', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentSessionQuality(projectId);
  });
}
