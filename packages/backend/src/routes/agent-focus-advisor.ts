import { FastifyInstance } from 'fastify';
import { adviseFocus } from '../services/agent-focus-advisor-service.js';

export async function agentFocusAdvisorRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-focus-advisor', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await adviseFocus(projectId);
    return result;
  });
}
