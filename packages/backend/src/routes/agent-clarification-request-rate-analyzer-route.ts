import { FastifyInstance } from 'fastify';
import { analyzeAgentClarificationRequestRate } from '../services/agent-clarification-request-rate-analyzer-service';

export async function agentClarificationRequestRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-clarification-request-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentClarificationRequestRate();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent clarification request rate' });
    }
  });
}
