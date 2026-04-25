import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseTimeEfficiency } from '../services/agent-response-time-efficiency-service.js';

export async function agentResponseTimeEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-response-time-efficiency',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentResponseTimeEfficiency(projectId);
    },
  );
}
