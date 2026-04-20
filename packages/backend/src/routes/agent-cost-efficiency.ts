import { FastifyInstance } from 'fastify';
import { analyzeAgentCostEfficiency } from '../services/agent-cost-efficiency-service.js';

export async function agentCostEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-cost-efficiency', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentCostEfficiency(projectId);
    return result;
  });
}
