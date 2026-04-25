import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeRecencyIndexAnalyzer } from '../services/agent-knowledge-recency-index-analyzer-service.js';

export async function agentKnowledgeRecencyIndexAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-knowledge-recency-index-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent knowledge recency index' });
    }
  });
}
