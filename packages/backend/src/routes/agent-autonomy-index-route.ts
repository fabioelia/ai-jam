import { FastifyInstance } from 'fastify';
import { analyzeAgentAutonomyIndex } from '../services/agent-autonomy-index-service.js';

export async function agentAutonomyIndexRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-autonomy-index', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentAutonomyIndex(projectId);
  });
}
