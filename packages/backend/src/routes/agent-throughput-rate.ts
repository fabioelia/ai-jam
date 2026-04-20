import { FastifyInstance } from 'fastify';
import { analyzeAgentThroughputRate } from '../services/agent-throughput-rate-service.js';

export async function agentThroughputRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-throughput-rate', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentThroughputRate(projectId);
    return result;
  });
}
