import { FastifyInstance } from 'fastify';
import { analyzeAgentThroughput } from '../services/agent-throughput-service.js';

export async function agentThroughputRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-throughput', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentThroughput(projectId);
  });
}
