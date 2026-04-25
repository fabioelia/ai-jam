import { FastifyInstance } from 'fastify';
import { analyzeAgentSessionWarmUpTimeAnalyzer } from '../services/agent-session-warm-up-time-analyzer-service.js';

export async function agentSessionWarmUpTimeAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-session-warm-up-time-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSessionWarmUpTimeAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent session warm-up time' });
    }
  });
}
