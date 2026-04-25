import { FastifyInstance } from 'fastify';
import { analyzeAgentSpecializationIndex } from '../services/agent-specialization-index-service.js';

export async function agentSpecializationIndexRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-specialization-index', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentSpecializationIndex(projectId);
  });
}
