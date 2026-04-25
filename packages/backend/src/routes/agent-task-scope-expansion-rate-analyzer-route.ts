import { FastifyInstance } from 'fastify';
import { analyzeAgentTaskScopeExpansionRateAnalyzer } from '../services/agent-task-scope-expansion-rate-analyzer-service.js';

export async function agentTaskScopeExpansionRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-task-scope-expansion-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent task scope expansion rate' });
    }
  });
}
