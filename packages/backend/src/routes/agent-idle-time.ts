import { FastifyInstance } from 'fastify';
import { analyzeAgentIdleTime } from '../services/agent-idle-time-service.js';

export async function agentIdleTimeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-idle-time', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentIdleTime(projectId);
  });
}
