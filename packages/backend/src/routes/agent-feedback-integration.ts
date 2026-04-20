import { FastifyInstance } from 'fastify';
import { analyzeAgentFeedbackIntegration } from '../services/agent-feedback-integration-service.js';

export async function agentFeedbackIntegrationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-feedback-integration', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentFeedbackIntegration(projectId);
  });
}
