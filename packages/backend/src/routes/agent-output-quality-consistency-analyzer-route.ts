import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputQualityConsistency } from '../services/agent-output-quality-consistency-analyzer-service.js';

export async function agentOutputQualityConsistencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-output-quality-consistency-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentOutputQualityConsistency(projectId);
  });
}
