import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputConsistencyRate } from '../services/agent-output-consistency-rate-analyzer-service';

export async function agentOutputConsistencyRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-output-consistency-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentOutputConsistencyRate();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent output consistency rate' });
    }
  });
}
