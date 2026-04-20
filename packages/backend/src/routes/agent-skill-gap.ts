import { FastifyInstance } from 'fastify';
import { analyzeSkillGaps } from '../services/agent-skill-gap-service.js';

export async function agentSkillGapRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-skill-gap', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeSkillGaps(projectId);
  });
}
