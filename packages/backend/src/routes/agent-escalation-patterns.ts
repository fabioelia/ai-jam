import { FastifyInstance } from 'fastify';
import { analyzeEscalationPatterns } from '../services/agent-escalation-pattern-service.js';

export async function agentEscalationPatternRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-escalation-pattern', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeEscalationPatterns(projectId);
  });
}
