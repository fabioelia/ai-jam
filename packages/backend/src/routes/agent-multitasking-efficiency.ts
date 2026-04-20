import { FastifyInstance } from 'fastify';
import { analyzeMultitaskingEfficiency } from '../services/agent-multitasking-efficiency-service.js';

export async function agentMultitaskingEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-multitasking-efficiency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeMultitaskingEfficiency(projectId);
    return result;
  });
}
