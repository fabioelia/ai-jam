import { FastifyInstance } from 'fastify';
import { analyzeAgentResourceConsumption } from '../services/agent-resource-consumption-service.js';

export async function agentResourceConsumptionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-resource-consumption', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentResourceConsumption(projectId);
  });
}
