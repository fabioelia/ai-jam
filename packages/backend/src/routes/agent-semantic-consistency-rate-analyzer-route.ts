import { FastifyInstance } from 'fastify';
import { analyzeAgentSemanticConsistencyRateAnalyzer } from '../services/agent-semantic-consistency-rate-analyzer-service.js';

export async function agentSemanticConsistencyRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-semantic-consistency-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent semantic consistency rate' });
    }
  });
}
