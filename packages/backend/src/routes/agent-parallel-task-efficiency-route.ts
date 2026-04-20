import { FastifyInstance } from 'fastify';
import { analyzeAgentParallelTaskEfficiency } from '../services/agent-parallel-task-efficiency-service.js';

export async function agentParallelTaskEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-parallel-task-efficiency',
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const result = await analyzeAgentParallelTaskEfficiency(projectId);
      return result;
    },
  );
}
