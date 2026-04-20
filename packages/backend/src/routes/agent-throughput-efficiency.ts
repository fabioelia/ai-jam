import { FastifyInstance } from 'fastify';
import { analyzeAgentThroughputEfficiency } from '../services/agent-throughput-efficiency-service.js';

export async function agentThroughputEfficiencyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-throughput-efficiency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentThroughputEfficiency(projectId);
  });
}
