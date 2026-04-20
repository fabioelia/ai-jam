import { FastifyInstance } from 'fastify';
import { analyzeAgentLearningVelocity } from '../services/agent-learning-velocity-service.js';

export async function agentLearningVelocityRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-learning-velocity', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentLearningVelocity(projectId);
    return reply.send(result);
  });
}
