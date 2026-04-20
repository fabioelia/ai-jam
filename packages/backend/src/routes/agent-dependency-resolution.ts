import { FastifyInstance } from 'fastify';
import { analyzeAgentDependencyResolution } from '../services/agent-dependency-resolution-service.js';

export async function agentDependencyResolutionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-dependency-resolution', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentDependencyResolution(projectId);
  });
}
