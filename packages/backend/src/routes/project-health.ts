import { FastifyInstance } from 'fastify';
import { analyzeProjectHealth } from '../services/project-health-service.js';

export async function projectHealthRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/health', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeProjectHealth(projectId);
    if (!result) return reply.status(404).send({ error: 'Project not found' });
    return result;
  });
}
