import { FastifyInstance } from 'fastify';
import { forecastVelocity } from '../services/agent-velocity-forecaster-service.js';

export async function agentVelocityForecasterRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-velocity-forecast', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await forecastVelocity(projectId);
    return result;
  });
}
