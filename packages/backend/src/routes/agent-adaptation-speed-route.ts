import { FastifyInstance } from 'fastify';
import { analyzeAgentAdaptationSpeed } from '../services/agent-adaptation-speed-service.js';

export async function agentAdaptationSpeedRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-adaptation-speed', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentAdaptationSpeed(projectId);
  });
}
