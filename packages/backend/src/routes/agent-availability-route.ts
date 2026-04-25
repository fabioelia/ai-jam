import { FastifyInstance } from 'fastify';
import { analyzeAgentAvailability } from '../services/agent-availability-service.js';

export async function agentAvailabilityRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-availability', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentAvailability(projectId);
  });
}
