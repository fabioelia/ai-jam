import { FastifyInstance } from 'fastify';
import { analyzeAgentCollaborationEfficiencyAnalyzer } from '../services/agent-collaboration-efficiency-analyzer-service';

export async function agentCollaborationEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-collaboration-efficiency-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentCollaborationEfficiencyAnalyzer(projectId);
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent collaboration efficiency' });
    }
  });
}
