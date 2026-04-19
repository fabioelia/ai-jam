import { FastifyInstance } from 'fastify';
import { checkReleaseReadiness } from '../services/release-readiness-service.js';

export async function releaseReadinessRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/release-readiness', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { featureId } = request.query as { featureId?: string };

    const result = await checkReleaseReadiness(projectId, featureId);
    if (!result) return reply.status(404).send({ error: 'Project not found' });
    return result;
  });
}
