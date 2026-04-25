import { FastifyInstance } from 'fastify';
import { analyzeAgentSelfCorrectionRateAnalyzer } from '../services/agent-self-correction-rate-analyzer-service.js';

export async function agentSelfCorrectionRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-self-correction-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSelfCorrectionRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent self-correction rate' });
    }
  });
}
