import { FastifyInstance } from 'fastify';
import { analyzeAgentSuccessRate } from '../services/agent-success-rate-service.js';

export async function agentSuccessRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-success-rate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentSuccessRate(projectId);
    return result;
  });
}
