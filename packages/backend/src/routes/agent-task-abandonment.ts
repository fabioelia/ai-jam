import { FastifyInstance } from 'fastify';
import { analyzeAgentTaskAbandonment } from '../services/agent-task-abandonment-service.js';

export async function agentTaskAbandonmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-task-abandonment', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentTaskAbandonment(projectId);
  });
}
