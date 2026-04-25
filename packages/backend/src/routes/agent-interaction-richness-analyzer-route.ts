import { FastifyInstance } from 'fastify';
import { analyzeAgentInteractionRichnessAnalyzer } from '../services/agent-interaction-richness-analyzer-service.js';

export async function agentInteractionRichnessAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-interaction-richness-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInteractionRichnessAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent interaction richness' });
    }
  });
}
