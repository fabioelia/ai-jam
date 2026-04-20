import { FastifyInstance } from 'fastify';
import { analyzeAgentCollaborationEfficiency } from '../services/agent-collaboration-efficiency-service.js';

export async function agentCollaborationEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-collaboration-efficiency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentCollaborationEfficiency(projectId);
  });
}
