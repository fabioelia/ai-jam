import { FastifyInstance } from 'fastify';
import { analyzeBottlenecks } from '../services/agent-bottleneck-analyzer-service.js';

export async function agentBottleneckAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-bottleneck-analyzer', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeBottlenecks(projectId);
  });
}
