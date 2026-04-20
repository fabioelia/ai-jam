import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseLatency } from '../services/agent-response-latency-service.js';

export async function agentResponseLatencyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-response-latency', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return await analyzeAgentResponseLatency(projectId);
  });
}
