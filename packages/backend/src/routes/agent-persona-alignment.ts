import { FastifyInstance } from 'fastify';
import { analyzePersonaAlignment } from '../services/agent-persona-alignment-service.js';

export async function agentPersonaAlignmentRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-persona-alignment', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzePersonaAlignment(projectId);
    return result;
  });
}
