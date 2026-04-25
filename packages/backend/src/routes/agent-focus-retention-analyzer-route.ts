import { FastifyInstance } from 'fastify';
import { analyzeAgentFocusRetention } from '../services/agent-focus-retention-analyzer-service.js';

export async function agentFocusRetentionAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-focus-retention-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentFocusRetention();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent focus retention' });
    }
  });
}
