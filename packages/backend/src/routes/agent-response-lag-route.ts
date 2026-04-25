import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseLag } from '../services/agent-response-lag-service.js';

export async function agentResponseLagRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-response-lag', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentResponseLag(projectId);
  });
}
