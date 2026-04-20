import { FastifyInstance } from 'fastify';
import { analyzeAgentContextRetention } from '../services/agent-context-retention-service.js';

export async function agentContextRetentionRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-context-retention', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentContextRetention(projectId);
    return result;
  });
}
