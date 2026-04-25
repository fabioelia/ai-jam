import { FastifyInstance } from 'fastify';
import { analyzeAgentMultiModalProcessingEfficiency } from '../services/agent-multi-modal-processing-efficiency-analyzer-service.js';

export async function agentMultiModalProcessingEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-multi-modal-processing-efficiency-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentMultiModalProcessingEfficiency(projectId);
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent multi-modal processing efficiency' });
    }
  });
}
