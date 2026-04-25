import { FastifyInstance } from 'fastify';
import { analyzeAgentContextUtilizationEfficiency } from '../services/agent-context-utilization-efficiency-analyzer-service.js';

export async function agentContextUtilizationEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-context-utilization-efficiency-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentContextUtilizationEfficiency(projectId);
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent context utilization efficiency' });
    }
  });
}
