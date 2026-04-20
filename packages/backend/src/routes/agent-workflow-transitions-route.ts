import { FastifyInstance } from 'fastify';
import { analyzeAgentWorkflowTransitions } from '../services/agent-workflow-transition-service.js';

export async function agentWorkflowTransitionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.post('/api/projects/:projectId/agent-workflow-transitions', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentWorkflowTransitions(projectId);
  });
}
