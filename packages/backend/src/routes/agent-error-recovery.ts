import { FastifyInstance } from 'fastify';
import { analyzeAgentErrorRecovery } from '../services/agent-error-recovery-service.js';

export async function agentErrorRecoveryRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-error-recovery', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentErrorRecovery(projectId);
    return result;
  });
}
