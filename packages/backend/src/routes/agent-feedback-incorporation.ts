import { FastifyInstance } from 'fastify';
import { analyzeAgentFeedbackIncorporation } from '../services/agent-feedback-incorporation-service.js';

export async function agentFeedbackIncorporationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-feedback-incorporation', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentFeedbackIncorporation(projectId);
    return result;
  });
}
