import { FastifyInstance } from 'fastify';
import { analyzeAgentContextRetention } from '../services/agent-context-retention-service.js';

export async function agentContextRetentionRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-context-retention',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentContextRetention(projectId);
    },
  );
}
