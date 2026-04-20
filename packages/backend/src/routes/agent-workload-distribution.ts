import { FastifyInstance } from 'fastify';
import { analyzeWorkloadDistribution } from '../services/agent-workload-distribution-service.js';

export async function agentWorkloadDistributionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-workload-distribution', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeWorkloadDistribution(projectId);
  });
}
