import { FastifyInstance } from 'fastify';
import { analyzeHandoffChainDepth } from '../services/agent-handoff-chain-depth-service.js';

export async function agentHandoffChainDepthRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-handoff-chain-depth', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeHandoffChainDepth(projectId);
  });
}
