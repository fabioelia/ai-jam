import { FastifyInstance } from 'fastify';
import { analyzeAgentRetryPattern } from '../services/agent-retry-pattern-service.js';

export async function agentRetryPatternRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-retry-pattern', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentRetryPattern(projectId);
    return result;
  });
}
