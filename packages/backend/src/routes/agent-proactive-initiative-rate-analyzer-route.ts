import { FastifyInstance } from 'fastify';
import { analyzeAgentProactiveInitiativeRateAnalyzer } from '../services/agent-proactive-initiative-rate-analyzer-service.js';

export async function agentProactiveInitiativeRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-proactive-initiative-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentProactiveInitiativeRateAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent proactive initiative rate' });
    }
  });
}
