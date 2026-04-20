import { FastifyInstance } from 'fastify';
import { profileResponseTimes } from '../services/agent-response-time-service.js';

export async function agentResponseTimeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-response-time', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await profileResponseTimes(projectId);
    return result;
  });
}
