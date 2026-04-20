import { FastifyInstance } from 'fastify';
import { analyzeAgentDeadlineAdherence } from '../services/agent-deadline-adherence-service.js';

export async function agentDeadlineAdherenceRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-deadline-adherence', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentDeadlineAdherence(projectId);
    return result;
  });
}
