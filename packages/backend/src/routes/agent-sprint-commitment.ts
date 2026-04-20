import { FastifyInstance } from 'fastify';
import { analyzeSprintCommitment } from '../services/agent-sprint-commitment-service.js';

export async function agentSprintCommitmentRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-sprint-commitment', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeSprintCommitment(projectId);
    return result;
  });
}
