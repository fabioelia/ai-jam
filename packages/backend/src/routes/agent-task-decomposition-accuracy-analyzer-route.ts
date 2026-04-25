import { FastifyInstance } from 'fastify';
import { analyzeAgentTaskDecompositionAccuracyAnalyzer } from '../services/agent-task-decomposition-accuracy-analyzer-service';

export async function agentTaskDecompositionAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-task-decomposition-accuracy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentTaskDecompositionAccuracyAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent task decomposition accuracy' });
    }
  });
}
