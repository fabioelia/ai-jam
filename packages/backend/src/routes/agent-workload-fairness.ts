import { FastifyInstance } from 'fastify';
import { analyzeWorkloadFairness } from '../services/agent-workload-fairness-service.js';

export async function agentWorkloadFairnessRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-workload-fairness', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeWorkloadFairness(projectId);
  });
}
