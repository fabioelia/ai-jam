import { FastifyInstance } from 'fastify';
import { analyzeAgentEscalationRate } from '../services/agent-escalation-rate-service.js';

export async function agentEscalationRateRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-escalation-rate', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentEscalationRate(projectId);
  });
}
