import { FastifyInstance } from 'fastify';
import { analyzeAgentPriorityAlignment } from '../services/agent-priority-alignment-service.js';

export async function agentPriorityAlignmentRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-priority-alignment', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentPriorityAlignment(projectId);
    return result;
  });
}
