import { FastifyInstance } from 'fastify';
import { analyzeAgentPerformance } from '../services/agent-performance-service.js';

export async function agentPerformanceRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-performance', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const result = await analyzeAgentPerformance(projectId);
    return result;
  });
}
