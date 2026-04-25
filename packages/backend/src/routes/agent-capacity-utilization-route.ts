import { FastifyInstance } from 'fastify';
import { analyzeAgentCapacityUtilization } from '../services/agent-capacity-utilization-service.js';

export async function agentCapacityUtilizationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-capacity-utilization', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentCapacityUtilization(projectId);
  });
}
