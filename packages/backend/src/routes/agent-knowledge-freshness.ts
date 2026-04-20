import { FastifyInstance } from 'fastify';
import { analyzeKnowledgeFreshness } from '../services/agent-knowledge-freshness-service.js';

export async function agentKnowledgeFreshnessRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-knowledge-freshness', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeKnowledgeFreshness(projectId);
  });
}
