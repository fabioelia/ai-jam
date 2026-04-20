import { FastifyInstance } from 'fastify';
import { detectBurnout } from '../services/agent-burnout-service.js';

export async function agentBurnoutRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-burnout', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await detectBurnout(projectId);
    return result;
  });
}
