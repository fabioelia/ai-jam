import { FastifyInstance } from 'fastify';
import { detectEscalations } from '../services/escalation-detector-service.js';

export async function escalationDetectorRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/escalation-detect', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await detectEscalations(projectId);
    return result;
  });
}
