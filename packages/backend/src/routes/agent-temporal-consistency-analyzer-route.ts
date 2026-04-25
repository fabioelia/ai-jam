import { FastifyInstance } from 'fastify';
import { analyzeAgentTemporalConsistencyAnalyzer } from '../services/agent-temporal-consistency-analyzer-service.js';

export async function agentTemporalConsistencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-temporal-consistency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentTemporalConsistencyAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent temporal consistency' });
    }
  });
}
