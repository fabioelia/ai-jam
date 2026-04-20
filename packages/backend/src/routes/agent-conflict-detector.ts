import { FastifyInstance } from 'fastify';
import { detectConflicts } from '../services/agent-conflict-detector-service.js';

export async function agentConflictDetectorRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-conflict-detector', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return detectConflicts(projectId);
  });
}
