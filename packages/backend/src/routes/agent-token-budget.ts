import { FastifyInstance } from 'fastify';
import { analyzeAgentTokenBudget } from '../services/agent-token-budget-service.js';

export async function agentTokenBudgetRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-token-budget', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentTokenBudget(projectId);
    return result;
  });
}
