import { FastifyInstance } from 'fastify';
import { analyzeAgentSessionDuration } from '../services/agent-session-duration-analyzer-service.js';

export async function agentSessionDurationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-session-duration-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentSessionDuration(projectId);
  });
}
