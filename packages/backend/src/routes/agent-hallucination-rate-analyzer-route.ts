import { FastifyInstance } from 'fastify';
import { analyzeAgentHallucinationRateAnalyzer } from '../services/agent-hallucination-rate-analyzer-service.js';

export async function agentHallucinationRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-hallucination-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentHallucinationRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent hallucination rate' });
    }
  });
}
