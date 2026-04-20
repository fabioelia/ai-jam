import { FastifyInstance } from 'fastify';
import { analyzeAgentCommunicationQuality } from '../services/agent-communication-quality-service.js';

export async function agentCommunicationQualityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-communication-quality', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentCommunicationQuality(projectId);
  });
}
