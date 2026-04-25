import { FastifyInstance } from 'fastify';
import { analyzeAgentSemanticOverlapAnalyzer } from '../services/agent-semantic-overlap-analyzer-service';

export async function agentSemanticOverlapAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-semantic-overlap-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSemanticOverlapAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent semantic overlap' });
    }
  });
}
