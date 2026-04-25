import { FastifyInstance } from 'fastify';
import { analyzeBurnoutRisk } from '../services/agent-burnout-risk-service.js';

export async function agentBurnoutRiskRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-burnout-risk', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeBurnoutRisk(projectId);
  });
}
