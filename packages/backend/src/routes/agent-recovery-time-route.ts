import { FastifyInstance } from 'fastify';
import { analyzeAgentRecoveryTime } from '../services/agent-recovery-time-service.js';

export async function agentRecoveryTimeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-recovery-time', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentRecoveryTime(projectId);
  });
}
