import { FastifyInstance } from 'fastify';
import { analyzeAgentContextRetentionAnalyzer } from '../services/agent-context-retention-analyzer-service.js';

export async function agentContextRetentionAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-context-retention-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentContextRetentionAnalyzer(projectId);
  });
}
