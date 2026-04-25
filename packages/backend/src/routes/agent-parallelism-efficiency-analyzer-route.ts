import { FastifyInstance } from 'fastify';
import { analyzeAgentParallelismEfficiencyAnalyzer } from '../services/agent-parallelism-efficiency-analyzer-service.js';

export async function agentParallelismEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-parallelism-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentParallelismEfficiencyAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent parallelism efficiency' });
    }
  });
}
