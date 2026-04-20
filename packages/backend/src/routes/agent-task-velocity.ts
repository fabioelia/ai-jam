import { FastifyInstance } from 'fastify';
import { analyzeAgentTaskVelocity } from '../services/agent-task-velocity-service.js';

export async function agentTaskVelocityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-task-velocity', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentTaskVelocity(projectId);
  });
}
