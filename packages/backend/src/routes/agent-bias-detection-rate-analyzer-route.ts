import { FastifyInstance } from 'fastify';
import { analyzeAgentBiasDetectionRate } from '../services/agent-bias-detection-rate-analyzer-service.js';

export async function agentBiasDetectionRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-bias-detection-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentBiasDetectionRate();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent bias detection rate' });
    }
  });
}
