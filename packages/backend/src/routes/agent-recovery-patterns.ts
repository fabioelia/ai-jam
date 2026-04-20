import { FastifyInstance } from 'fastify';
import { analyzeRecoveryPatterns } from '../services/agent-recovery-pattern-service.js';

export async function agentRecoveryPatternRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/api/projects/:projectId/agent-recovery-patterns', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeRecoveryPatterns(projectId);
  });
}
