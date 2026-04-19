import { FastifyInstance } from 'fastify';
import { analyzeRouting } from '../services/agent-routing-service.js';

export async function agentRoutingRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-routing', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeRouting(projectId);
    return result;
  });
}
