import { FastifyInstance } from 'fastify';
import { analyzeAgentCostPerOutcome } from '../services/agent-cost-per-outcome-service.js';

export async function agentCostPerOutcomeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-cost-per-outcome', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentCostPerOutcome(projectId);
  });
}
