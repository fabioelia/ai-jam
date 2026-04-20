import { FastifyInstance } from 'fastify';
import { analyzePerformanceTrends } from '../services/agent-performance-trend-service.js';

export async function agentPerformanceTrendRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-performance-trend', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzePerformanceTrends(projectId);
  });
}
