import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseTimeEfficiency } from '../services/agent-response-time-efficiency-service.js';

export async function agentResponseTimeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-response-time', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentResponseTimeEfficiency(projectId);
    return result;
  });
}
