import { FastifyInstance } from 'fastify';
import { analyzeCollaborationGraph } from '../services/agent-collaboration-graph-service.js';

export async function agentCollaborationGraphRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-collaboration-graph', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeCollaborationGraph(projectId);
    return result;
  });
}
