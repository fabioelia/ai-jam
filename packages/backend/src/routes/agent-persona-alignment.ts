import { FastifyInstance } from 'fastify';
import { analyzeAgentPersonaAlignment } from '../services/agent-persona-alignment-service.js';

export async function agentPersonaAlignmentRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-persona-alignment', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentPersonaAlignment(projectId);
    return result;
  });
}
