import { FastifyInstance } from 'fastify';
import { analyzeAgentQueueDepth } from '../services/agent-queue-depth-analyzer-service.js';

export async function agentQueueDepthAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-queue-depth-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentQueueDepth(projectId);
  });
}
