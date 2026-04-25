import { FastifyInstance } from 'fastify';
import { analyzeAgentContextSwitchingCostAnalyzer } from '../services/agent-context-switching-cost-analyzer-service.js';

export async function agentContextSwitchingCostAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-context-switching-cost-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentContextSwitchingCostAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent context switching cost' });
    }
  });
}
