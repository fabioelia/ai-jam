import { FastifyInstance } from 'fastify';
import { analyzeReworkRate } from '../services/agent-rework-rate-service.js';

export async function agentReworkRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-rework-rate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeReworkRate(projectId);
    return result;
  });
}
