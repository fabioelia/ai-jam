import { FastifyInstance } from 'fastify';
import { analyzeWorkload } from '../services/workload-balancer-service.js';

export async function workloadBalancerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/workload-balance', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = (request.body as { featureId?: string }) || {};
    const featureId = body.featureId;

    const result = await analyzeWorkload(projectId, featureId);
    if (!result) return reply.status(404).send({ error: 'Project not found' });
    return result;
  });
}
