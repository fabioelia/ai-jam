import { FastifyInstance } from 'fastify';
import { analyzeAgentUncertaintyQuantificationAnalyzer } from '../services/agent-uncertainty-quantification-analyzer-service';

export async function agentUncertaintyQuantificationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-uncertainty-quantification-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentUncertaintyQuantificationAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent uncertainty quantification' });
    }
  });
}
