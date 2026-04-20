import { FastifyInstance } from 'fastify';
import { detectAgentStalls } from '../services/agent-stall-detector-service.js';

export async function agentStallDetectorRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-stall-detector', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await detectAgentStalls(projectId);
    return result;
  });
}
