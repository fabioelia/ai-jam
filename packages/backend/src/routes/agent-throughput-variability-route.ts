import { FastifyInstance } from 'fastify';
import { analyzeAgentThroughputVariability } from '../services/agent-throughput-variability-service.js';

export async function agentThroughputVariabilityRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-throughput-variability', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentThroughputVariability(projectId);
  });
}
