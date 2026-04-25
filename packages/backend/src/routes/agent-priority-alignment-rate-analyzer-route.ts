import { FastifyInstance } from 'fastify';
import { analyzeAgentPriorityAlignmentRateAnalyzer } from '../services/agent-priority-alignment-rate-analyzer-service.js';

export async function agentPriorityAlignmentRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-priority-alignment-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentPriorityAlignmentRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent priority alignment rate' });
    }
  });
}
