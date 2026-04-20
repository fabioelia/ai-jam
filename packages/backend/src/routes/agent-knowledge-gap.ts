import { FastifyInstance } from 'fastify';
import { analyzeKnowledgeGaps } from '../services/agent-knowledge-gap-service.js';

export async function agentKnowledgeGapRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-knowledge-gaps', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeKnowledgeGaps(projectId);
    return result;
  });
}
