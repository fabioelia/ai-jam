import { FastifyInstance } from 'fastify';
import { analyzeAgentDependencies } from '../services/agent-dependency-mapper-service.js';

export async function agentDependencyMapperRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-dependency-mapper', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentDependencies(projectId);
  });
}
