import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeTransfer } from '../services/agent-knowledge-transfer-service.js';

export async function agentKnowledgeTransferRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-knowledge-transfer', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentKnowledgeTransfer(projectId);
  });
}
