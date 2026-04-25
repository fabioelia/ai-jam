import { FastifyInstance } from 'fastify';
import { analyzeAgentDelegationAccuracyAnalyzer } from '../services/agent-delegation-accuracy-analyzer-service.js';

export async function agentDelegationAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-delegation-accuracy-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentDelegationAccuracyAnalyzer(projectId);
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent delegation accuracy' });
    }
  });
}
