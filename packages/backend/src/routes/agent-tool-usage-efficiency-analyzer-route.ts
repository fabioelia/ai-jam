import { FastifyInstance } from 'fastify';
import { analyzeAgentToolUsageEfficiency } from '../services/agent-tool-usage-efficiency-analyzer-service.js';

export async function agentToolUsageEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-tool-usage-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentToolUsageEfficiency();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent tool usage efficiency' });
    }
  });
}
