import { FastifyInstance } from 'fastify';
import { analyzeAgentDelegationDepth } from '../services/agent-delegation-depth-service.js';

export async function agentDelegationDepthRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-delegation-depth', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const report = await analyzeAgentDelegationDepth(projectId);
    return reply.send(report);
  });
}
