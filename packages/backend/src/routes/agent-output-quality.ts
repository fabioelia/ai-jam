import { FastifyInstance } from 'fastify';
import { scoreAgentOutputQuality } from '../services/agent-output-quality-service.js';

export async function agentOutputQualityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-output-quality', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return scoreAgentOutputQuality(projectId);
  });
}
