import { FastifyInstance } from 'fastify';
import { estimateAgentCognitiveLoad } from '../services/agent-cognitive-load-estimator-service.js';

export async function agentCognitiveLoadEstimatorRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-cognitive-load-estimator', async (request, reply) => {
    try {
      const report = await estimateAgentCognitiveLoad();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to estimate agent cognitive load' });
    }
  });
}
