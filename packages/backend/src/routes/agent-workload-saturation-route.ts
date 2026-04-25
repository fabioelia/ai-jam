import { FastifyInstance } from 'fastify';
import { analyzeAgentWorkloadSaturation } from '../services/agent-workload-saturation-service.js';

export async function agentWorkloadSaturationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-workload-saturation', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentWorkloadSaturation(projectId);
  });
}
