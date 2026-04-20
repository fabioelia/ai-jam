import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputConsistency } from '../services/agent-output-consistency-service.js';

export async function agentOutputConsistencyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-output-consistency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentOutputConsistency(projectId);
  });
}
