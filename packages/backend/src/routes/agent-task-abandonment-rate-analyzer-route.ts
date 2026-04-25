import { FastifyInstance } from 'fastify';
import { analyzeAgentTaskAbandonmentRateAnalyzer } from '../services/agent-task-abandonment-rate-analyzer-service';

export async function agentTaskAbandonmentRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-task-abandonment-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentTaskAbandonmentRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent task abandonment rate' });
    }
  });
}
