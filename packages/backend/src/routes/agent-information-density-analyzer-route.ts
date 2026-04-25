import { FastifyInstance } from 'fastify';
import { analyzeAgentInformationDensityAnalyzer } from '../services/agent-information-density-analyzer-service';

export async function agentInformationDensityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-information-density-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInformationDensityAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent information density' });
    }
  });
}
