import { FastifyInstance } from 'fastify';
import { analyzeAgentSessionDuration } from '../services/agent-session-duration-service.js';

export async function agentSessionDurationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-session-duration', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentSessionDuration(projectId);
    return result;
  });
}
