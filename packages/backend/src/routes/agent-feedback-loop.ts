import { FastifyInstance } from 'fastify';
import { analyzeAgentFeedbackLoops } from '../services/agent-feedback-loop-service.js';

export async function agentFeedbackLoopRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.get('/api/agent-feedback-loops/:projectId', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentFeedbackLoops(projectId);
  });
}
