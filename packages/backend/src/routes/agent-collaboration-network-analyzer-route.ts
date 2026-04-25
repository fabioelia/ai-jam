import { FastifyInstance } from 'fastify';
import { analyzeAgentCollaborationNetwork } from '../services/agent-collaboration-network-analyzer-service.js';

export async function agentCollaborationNetworkAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-collaboration-network-analyzer',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentCollaborationNetwork(projectId);
    },
  );
}
