import { FastifyInstance } from 'fastify';
import { analyzeCollaborationNetwork } from '../services/agent-collaboration-network-service.js';

export async function agentCollaborationNetworkRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-collaboration-network', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeCollaborationNetwork(projectId);
    return result;
  });
}
