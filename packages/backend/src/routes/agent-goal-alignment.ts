import { FastifyInstance } from 'fastify';
import { analyzeGoalAlignment } from '../services/agent-goal-alignment-service.js';

export async function agentGoalAlignmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-goal-alignment', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeGoalAlignment(projectId);
  });
}
