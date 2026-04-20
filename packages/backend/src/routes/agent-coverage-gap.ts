import { FastifyInstance } from 'fastify';
import { analyzeCoverageGaps } from '../services/agent-coverage-gap-service.js';

export async function agentCoverageGapRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-coverage-gap', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeCoverageGaps(projectId);
  });
}
