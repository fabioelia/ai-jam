import { FastifyInstance } from 'fastify';
import { analyzeAgentHypothesisTestingRateAnalyzer } from '../services/agent-hypothesis-testing-rate-analyzer-service.js';

export async function agentHypothesisTestingRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-hypothesis-testing-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentHypothesisTestingRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent hypothesis testing rate' });
    }
  });
}
