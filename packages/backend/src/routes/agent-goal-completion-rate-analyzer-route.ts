import { FastifyInstance } from 'fastify';
import { analyzeAgentGoalCompletionRateAnalyzer } from '../services/agent-goal-completion-rate-analyzer-service.js';

export async function agentGoalCompletionRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-goal-completion-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentGoalCompletionRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent goal completion rate' });
    }
  });
}
