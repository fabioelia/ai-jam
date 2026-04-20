import { FastifyInstance } from 'fastify';
import { analyzeAgentQualitySpeed } from '../services/agent-quality-speed-service.js';

export async function agentQualitySpeedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-quality-speed', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentQualitySpeed(projectId);
  });
}
