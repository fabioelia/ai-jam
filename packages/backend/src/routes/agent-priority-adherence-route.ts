import { FastifyInstance } from 'fastify';
import { analyzeAgentPriorityAdherence } from '../services/agent-priority-adherence-service.js';

export async function agentPriorityAdherenceRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-priority-adherence', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as { sessions?: any[] } | null;
    const sessions = (body && body.sessions) ? body.sessions : [];
    const result = analyzeAgentPriorityAdherence(projectId, sessions);
    return result;
  });
}
