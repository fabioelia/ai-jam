import { FastifyInstance } from 'fastify';
import { analyzeAgentIdleTimeTracker } from '../services/agent-idle-time-tracker-service.js';

export async function agentIdleTimeTrackerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-idle-time-tracker', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentIdleTimeTracker(projectId);
  });
}
