import { FastifyInstance } from 'fastify';
import { analyzeAgentGoalCompletion } from '../services/agent-goal-completion-service.js';

export async function agentGoalCompletionRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-goal-completion', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = (request.body as { sessions?: any[] }) ?? {};
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    return analyzeAgentGoalCompletion(projectId, sessions);
  });
}
