import { FastifyInstance } from 'fastify';
import { analyzeAgentMetacognitiveAccuracyAnalyzer } from '../services/agent-metacognitive-accuracy-analyzer-service';

export async function agentMetacognitiveAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-metacognitive-accuracy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentMetacognitiveAccuracyAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent metacognitive accuracy' });
    }
  });
}
