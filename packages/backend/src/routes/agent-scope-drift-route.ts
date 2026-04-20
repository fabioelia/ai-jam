import { FastifyInstance } from 'fastify';
import { analyzeAgentScopeDrift } from '../services/agent-scope-drift-service.js';

export async function agentScopeDriftRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-scope-drift', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentScopeDrift(projectId);
  });
}
