import { FastifyInstance } from 'fastify';
import { analyzeAgentCognitiveLoad } from '../services/agent-cognitive-load-service.js';

export async function agentCognitiveLoadRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-cognitive-load', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentCognitiveLoad(projectId);
  });
}
