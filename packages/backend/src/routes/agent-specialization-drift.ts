import { FastifyInstance } from 'fastify';
import { analyzeSpecializationDrift } from '../services/agent-specialization-drift-service.js';

export async function agentSpecializationDriftRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-specialization-drift', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeSpecializationDrift(projectId);
    return result;
  });
}
