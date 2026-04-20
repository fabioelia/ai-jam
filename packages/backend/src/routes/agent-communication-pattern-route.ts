import { FastifyInstance } from 'fastify';
import { analyzeAgentCommunicationPatterns } from '../services/agent-communication-pattern-service.js';

export async function agentCommunicationPatternRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-communication-patterns', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as { sessions?: any[] };
    const sessions = body?.sessions ?? [];
    return analyzeAgentCommunicationPatterns(projectId, sessions);
  });
}
