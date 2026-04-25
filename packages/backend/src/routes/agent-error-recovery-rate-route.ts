import { FastifyInstance } from 'fastify';
import { analyzeAgentErrorRecoveryRate } from '../services/agent-error-recovery-rate-service.js';

export async function agentErrorRecoveryRateRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-error-recovery-rate',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentErrorRecoveryRate(projectId);
    },
  );
}
