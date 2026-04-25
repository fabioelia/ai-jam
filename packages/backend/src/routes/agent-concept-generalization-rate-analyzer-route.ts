import { FastifyInstance } from 'fastify';
import { analyzeAgentConceptGeneralizationRateAnalyzer } from '../services/agent-concept-generalization-rate-analyzer-service.js';

export async function agentConceptGeneralizationRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-concept-generalization-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentConceptGeneralizationRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent concept generalization rate' });
    }
  });
}
