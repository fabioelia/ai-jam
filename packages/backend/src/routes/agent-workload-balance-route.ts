import { FastifyInstance } from 'fastify';
import { analyzeAgentWorkloadBalance } from '../services/agent-workload-balance-service.js';

export async function agentWorkloadBalanceRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-workload-balance',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentWorkloadBalance(projectId);
    },
  );
}
