import { FastifyInstance } from 'fastify';
import { analyzeAgentInterruptions } from '../services/agent-interruption-impact-service.js';

export async function agentInterruptionImpactRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-interruption-impact', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentInterruptions(projectId);
  });
}
