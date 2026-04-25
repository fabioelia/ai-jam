import { FastifyInstance } from 'fastify';
import { analyzeAgentSpecializationDepth } from '../services/agent-specialization-depth-analyzer-service';

export async function agentSpecializationDepthAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-specialization-depth-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSpecializationDepth();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent specialization depth' });
    }
  });
}
