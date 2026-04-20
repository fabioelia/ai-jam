import { FastifyInstance } from 'fastify';
import { analyzeAgentScopeAdherence } from '../services/agent-scope-adherence-service.js';

export async function agentScopeAdherenceRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-scope-adherence', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentScopeAdherence(projectId);
    return result;
  });
}
