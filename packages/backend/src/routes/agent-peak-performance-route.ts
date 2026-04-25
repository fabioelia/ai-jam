import { FastifyInstance } from 'fastify';
import { analyzeAgentPeakPerformance } from '../services/agent-peak-performance-service.js';

export async function agentPeakPerformanceRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-peak-performance',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentPeakPerformance(projectId);
    },
  );
}
