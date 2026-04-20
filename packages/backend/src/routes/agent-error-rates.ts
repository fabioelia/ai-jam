import { FastifyInstance } from 'fastify';
import { analyzeAgentErrorRates } from '../services/agent-error-rate-service.js';

export async function agentErrorRatesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-error-rates', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentErrorRates(projectId);
  });
}
