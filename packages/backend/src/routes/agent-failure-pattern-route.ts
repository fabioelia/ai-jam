import { FastifyInstance } from 'fastify';
import { analyzeAgentFailurePatterns } from '../services/agent-failure-pattern-service.js';

export async function agentFailurePatternRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-failure-patterns', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentFailurePatterns(projectId);
  });
}
