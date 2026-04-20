import { FastifyInstance } from 'fastify';
import { analyzeAgentReworkRate } from '../services/agent-rework-rate-service.js';

export async function agentReworkRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-rework-rate', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentReworkRate(projectId);
    return result;
  });
}
