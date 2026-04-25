import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeSynthesisRate } from '../services/agent-knowledge-synthesis-rate-analyzer-service';

export async function agentKnowledgeSynthesisRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-knowledge-synthesis-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentKnowledgeSynthesisRate();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent knowledge synthesis rate' });
    }
  });
}
