import { FastifyInstance } from 'fastify';
import { analyzeTaskComplexity } from '../services/agent-task-complexity-service.js';

export async function agentTaskComplexityRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-task-complexity', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeTaskComplexity(projectId);
  });
}
