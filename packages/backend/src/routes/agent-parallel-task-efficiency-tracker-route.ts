import { FastifyInstance } from 'fastify';
import { analyzeAgentParallelTaskEfficiencyTracker } from '../services/agent-parallel-task-efficiency-tracker-service.js';

export async function agentParallelTaskEfficiencyTrackerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-parallel-task-efficiency-tracker', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentParallelTaskEfficiencyTracker(projectId);
  });
}
