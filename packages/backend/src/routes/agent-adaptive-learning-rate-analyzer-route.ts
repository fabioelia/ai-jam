import { FastifyInstance } from 'fastify';
import { analyzeAgentAdaptiveLearningRateAnalyzer } from '../services/agent-adaptive-learning-rate-analyzer-service.js';

export async function agentAdaptiveLearningRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-adaptive-learning-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentAdaptiveLearningRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent adaptive learning rate' });
    }
  });
}
