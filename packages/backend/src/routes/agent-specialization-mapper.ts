import { FastifyInstance } from 'fastify';
import { mapAgentSpecializations } from '../services/agent-specialization-mapper-service.js';

export async function agentSpecializationMapperRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-specialization-mapper', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await mapAgentSpecializations(projectId);
    return result;
  });
}
