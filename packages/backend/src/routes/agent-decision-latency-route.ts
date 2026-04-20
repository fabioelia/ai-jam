import { FastifyInstance } from 'fastify';
import { analyzeAgentDecisionLatency } from '../services/agent-decision-latency-service.js';

export async function agentDecisionLatencyRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-decision-latency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentDecisionLatency(projectId);
  });
}
