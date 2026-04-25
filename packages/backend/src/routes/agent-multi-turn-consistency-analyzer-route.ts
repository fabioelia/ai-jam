import { FastifyInstance } from 'fastify';
import { analyzeAgentMultiTurnConsistency } from '../services/agent-multi-turn-consistency-analyzer-service.js';

export async function agentMultiTurnConsistencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-multi-turn-consistency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentMultiTurnConsistency();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent multi-turn consistency' });
    }
  });
}
