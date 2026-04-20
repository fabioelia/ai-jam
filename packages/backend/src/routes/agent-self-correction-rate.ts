import { FastifyInstance } from 'fastify';
import { analyzeAgentSelfCorrectionRate } from '../services/agent-self-correction-rate-service.js';

export async function agentSelfCorrectionRateRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-self-correction-rate', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as { sessions?: any[] };
    const sessions = body?.sessions ?? [];
    return analyzeAgentSelfCorrectionRate(projectId, sessions);
  });
}
