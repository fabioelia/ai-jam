import { FastifyInstance } from 'fastify';
import { analyzeAgentBoundaryViolationRateAnalyzer } from '../services/agent-boundary-violation-rate-analyzer-service.js';

export async function agentBoundaryViolationRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-boundary-violation-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentBoundaryViolationRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent boundary violation rate' });
    }
  });
}
