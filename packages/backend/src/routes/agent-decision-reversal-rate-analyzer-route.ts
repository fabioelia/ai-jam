import { FastifyInstance } from 'fastify';
import { analyzeAgentDecisionReversalRateAnalyzer } from '../services/agent-decision-reversal-rate-analyzer-service.js';

export async function agentDecisionReversalRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-decision-reversal-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentDecisionReversalRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent decision reversal rate' });
    }
  });
}
