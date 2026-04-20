import { FastifyInstance } from 'fastify';
import { analyzeAgentReassignmentRates } from '../services/agent-reassignment-rate-service.js';

export async function agentReassignmentRatesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-reassignment-rates', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentReassignmentRates(projectId);
  });
}
