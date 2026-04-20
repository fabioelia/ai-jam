import { FastifyInstance } from 'fastify';
import { analyzeAgentBlockerFrequency } from '../services/agent-blocker-frequency-service.js';

export async function agentBlockerFrequencyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-blocker-frequency', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentBlockerFrequency(projectId);
    return result;
  });
}
