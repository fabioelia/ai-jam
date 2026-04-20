import { FastifyInstance } from 'fastify';
import { analyzeCollaboration } from '../services/agent-collaboration-service.js';

export async function agentCollaborationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-collaboration', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeCollaboration(projectId);
    return result;
  });
}
