import { FastifyInstance } from 'fastify';
import { analyzeAgentRetryRate } from '../services/agent-retry-rate-service.js';

export async function agentRetryRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-retry-rate', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentRetryRate(projectId);
  });
}
