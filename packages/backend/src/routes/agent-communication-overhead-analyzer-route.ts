import { FastifyInstance } from 'fastify';
import { analyzeAgentCommunicationOverheadAnalyzer } from '../services/agent-communication-overhead-analyzer-service.js';

export async function agentCommunicationOverheadAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-communication-overhead-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentCommunicationOverheadAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent communication overhead' });
    }
  });
}
