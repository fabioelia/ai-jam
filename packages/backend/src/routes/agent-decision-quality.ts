import { FastifyInstance } from 'fastify';
import { analyzeDecisionQuality } from '../services/agent-decision-quality-service.js';

export async function agentDecisionQualityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-decision-quality', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeDecisionQuality(projectId);
  });
}
