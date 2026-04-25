import { FastifyInstance } from 'fastify';
import { analyzeAgentGoalDrift } from '../services/agent-goal-drift-analyzer-service.js';

export async function agentGoalDriftAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-goal-drift-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentGoalDrift(projectId);
  });
}
