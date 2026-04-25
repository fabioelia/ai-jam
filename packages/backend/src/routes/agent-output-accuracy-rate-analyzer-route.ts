import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputAccuracyRateAnalyzer } from '../services/agent-output-accuracy-rate-analyzer-service.js';

export async function agentOutputAccuracyRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-output-accuracy-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentOutputAccuracyRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent output accuracy rate' });
    }
  });
}
