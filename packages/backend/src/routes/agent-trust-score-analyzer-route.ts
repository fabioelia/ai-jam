import { FastifyInstance } from 'fastify';
import { analyzeAgentTrustScoreAnalyzer } from '../services/agent-trust-score-analyzer-service.js';

export async function agentTrustScoreAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-trust-score-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentTrustScoreAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent trust score' });
    }
  });
}
