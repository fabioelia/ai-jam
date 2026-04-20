import { FastifyInstance } from 'fastify';
import { analyzeAgentEstimationAccuracy } from '../services/agent-estimation-accuracy-service.js';

export async function agentEstimationAccuracyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-estimation-accuracy', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentEstimationAccuracy(projectId);
  });
}
