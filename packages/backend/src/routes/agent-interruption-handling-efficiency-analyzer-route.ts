import { FastifyInstance } from 'fastify';
import { analyzeAgentInterruptionHandlingEfficiency } from '../services/agent-interruption-handling-efficiency-analyzer-service.js';

export async function agentInterruptionHandlingEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-interruption-handling-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInterruptionHandlingEfficiency();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent interruption handling efficiency' });
    }
  });
}
