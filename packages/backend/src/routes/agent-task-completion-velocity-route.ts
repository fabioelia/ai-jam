import { FastifyInstance } from 'fastify';
import { analyzeTaskCompletionVelocity } from '../services/agent-task-completion-velocity-service.js';

export async function agentTaskCompletionVelocityRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-task-completion-velocity', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeTaskCompletionVelocity(projectId);
  });
}
