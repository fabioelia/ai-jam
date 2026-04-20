import { FastifyInstance } from 'fastify';
import { analyzeAgentBlockedTime } from '../services/agent-blocked-time-service.js';

export async function agentBlockedTimeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-blocked-time', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentBlockedTime(projectId);
  });
}
