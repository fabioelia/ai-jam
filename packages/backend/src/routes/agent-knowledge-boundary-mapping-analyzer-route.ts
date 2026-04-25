import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeBoundaryMappingAnalyzer } from '../services/agent-knowledge-boundary-mapping-analyzer-service.js';

export async function agentKnowledgeBoundaryMappingAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-knowledge-boundary-mapping-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentKnowledgeBoundaryMappingAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent knowledge boundary mapping' });
    }
  });
}
