import { FastifyInstance } from 'fastify';
import { analyzeAgentIdleTime } from '../services/agent-idle-time-analyzer-service.js';

export async function agentIdleTimeAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-idle-time-analyzer',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentIdleTime(projectId);
    },
  );
}
