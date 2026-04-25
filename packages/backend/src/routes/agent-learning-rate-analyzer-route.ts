import { FastifyInstance } from 'fastify';
import { analyzeAgentLearningRate } from '../services/agent-learning-rate-analyzer-service.js';

export async function agentLearningRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-learning-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentLearningRate();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent learning rate' });
    }
  });
}
