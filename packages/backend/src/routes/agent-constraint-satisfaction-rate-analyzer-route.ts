import { FastifyInstance } from 'fastify';
import { analyzeAgentConstraintSatisfactionRate } from '../services/agent-constraint-satisfaction-rate-analyzer-service.js';

export async function agentConstraintSatisfactionRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-constraint-satisfaction-rate-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentConstraintSatisfactionRate(projectId);
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent constraint satisfaction rate' });
    }
  });
}
