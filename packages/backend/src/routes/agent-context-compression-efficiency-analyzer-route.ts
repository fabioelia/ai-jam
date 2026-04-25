import { FastifyInstance } from 'fastify';
import { analyzeAgentContextCompressionEfficiency } from '../services/agent-context-compression-efficiency-analyzer-service';

export async function agentContextCompressionEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-context-compression-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentContextCompressionEfficiency();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent context compression efficiency' });
    }
  });
}
