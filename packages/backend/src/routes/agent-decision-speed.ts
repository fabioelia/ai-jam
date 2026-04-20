import { FastifyInstance } from 'fastify';
import { analyzeAgentDecisionSpeed } from '../services/agent-decision-speed-service.js';

export async function agentDecisionSpeedRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-decision-speed', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentDecisionSpeed(projectId);
    return result;
  });
}
