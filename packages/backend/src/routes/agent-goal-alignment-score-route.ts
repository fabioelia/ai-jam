import { FastifyInstance } from 'fastify';
import { analyzeAgentGoalAlignment } from '../services/agent-goal-alignment-score-service.js';

export async function agentGoalAlignmentScoreRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-goal-alignment-score', async (request, reply) => {
    try {
      const report = await analyzeAgentGoalAlignment();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent goal alignment' });
    }
  });
}
