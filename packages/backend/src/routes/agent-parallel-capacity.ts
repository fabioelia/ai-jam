import { FastifyInstance } from 'fastify';
import { analyzeParallelCapacity } from '../services/agent-parallel-capacity-service.js';

export async function agentParallelCapacityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-parallel-capacity', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeParallelCapacity(projectId);
  });
}
