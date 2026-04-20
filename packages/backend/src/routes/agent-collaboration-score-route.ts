import { FastifyInstance } from 'fastify';
import { analyzeAgentCollaboration } from '../services/agent-collaboration-score-service.js';

export async function agentCollaborationScoreRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-collaboration-score', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentCollaboration(projectId);
  });
}
