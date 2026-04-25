import { FastifyInstance } from 'fastify';
import { analyzeAgentSpecializationDriftAnalyzer } from '../services/agent-specialization-drift-analyzer-service.js';

export async function agentSpecializationDriftAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-specialization-drift-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSpecializationDriftAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent specialization drift' });
    }
  });
}
