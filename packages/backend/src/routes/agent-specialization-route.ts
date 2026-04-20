import { FastifyInstance } from 'fastify';
import { analyzeAgentSpecialization } from '../services/agent-specialization-service.js';

export async function agentSpecializationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-specialization', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentSpecialization(projectId);
  });
}
