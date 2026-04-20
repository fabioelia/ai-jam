import { FastifyInstance } from 'fastify';
import { monitorQueueDepths } from '../services/agent-queue-depth-service.js';

export async function agentQueueDepthRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-queue-depth', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return monitorQueueDepths(projectId);
  });
}
