import { FastifyInstance } from 'fastify';
import { analyzeAgentGoalDriftRateAnalyzer } from '../services/agent-goal-drift-rate-analyzer-service.js';

export async function agentGoalDriftRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-goal-drift-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentGoalDriftRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent goal drift rate' });
    }
  });
}
