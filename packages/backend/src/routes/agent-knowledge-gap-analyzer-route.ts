import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeGaps } from '../services/agent-knowledge-gap-analyzer-service.js';

export async function agentKnowledgeGapAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-knowledge-gap-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentKnowledgeGaps(projectId);
  });
}
