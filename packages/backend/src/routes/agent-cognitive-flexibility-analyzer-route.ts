import { FastifyInstance } from 'fastify';
import { analyzeAgentCognitiveFlexibilityAnalyzer } from '../services/agent-cognitive-flexibility-analyzer-service.js';

export async function agentCognitiveFlexibilityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-cognitive-flexibility-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentCognitiveFlexibilityAnalyzer(projectId);
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent cognitive flexibility' });
    }
  });
}
