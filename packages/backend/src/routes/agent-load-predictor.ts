import { FastifyInstance } from 'fastify';
import { predictLoad } from '../services/agent-load-predictor-service.js';

export async function agentLoadPredictorRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-load-predictor', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await predictLoad(projectId);
    return result;
  });
}
