import { FastifyInstance } from 'fastify';
import { analyzeAgentHandoffQuality } from '../services/agent-handoff-quality-service.js';

export async function agentHandoffQualityRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-handoff-quality', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentHandoffQuality(projectId);
  });
}
