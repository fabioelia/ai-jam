import { FastifyInstance } from 'fastify';
import { analyzeAgentCrossDomainTransferAnalyzer } from '../services/agent-cross-domain-transfer-analyzer-service.js';

export async function agentCrossDomainTransferAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-cross-domain-transfer-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentCrossDomainTransferAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent cross-domain transfer' });
    }
  });
}
