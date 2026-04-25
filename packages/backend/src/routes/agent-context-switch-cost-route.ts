import { FastifyInstance } from 'fastify';
import { analyzeContextSwitchCost } from '../services/agent-context-switch-cost-service.js';

export async function agentContextSwitchCostRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-context-switch-cost',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeContextSwitchCost(projectId);
    },
  );
}
