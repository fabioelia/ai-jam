import { FastifyInstance } from 'fastify';
import { analyzeAgentTokenCostEfficiency } from '../services/agent-token-cost-efficiency-service.js';

export async function agentTokenCostEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-token-cost-efficiency',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentTokenCostEfficiency(projectId);
    },
  );
}
