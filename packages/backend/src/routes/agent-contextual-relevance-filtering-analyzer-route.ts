import { FastifyInstance } from 'fastify';
import { analyzeAgentContextualRelevanceFiltering } from '../services/agent-contextual-relevance-filtering-analyzer-service';

export async function agentContextualRelevanceFilteringAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-contextual-relevance-filtering-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentContextualRelevanceFiltering();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent contextual relevance filtering' });
    }
  });
}
