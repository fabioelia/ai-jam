import { FastifyInstance } from 'fastify';
import { analyzeHandoffSuccessRate } from '../services/agent-handoff-success-rate-service.js';

export async function agentHandoffSuccessRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-handoff-success-rate', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeHandoffSuccessRate(projectId);
  });
}
