import { FastifyInstance } from 'fastify';
import { analyzeInterruptionFrequency } from '../services/agent-interruption-frequency-service.js';

export async function agentInterruptionFrequencyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-interruption-frequency', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeInterruptionFrequency(projectId);
  });
}
