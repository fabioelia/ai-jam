import { FastifyInstance } from 'fastify';
import { analyzeAgentFeedbackIntegrationSpeedAnalyzer } from '../services/agent-feedback-integration-speed-analyzer-service.js';

export async function agentFeedbackIntegrationSpeedAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-feedback-integration-speed-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent feedback integration speed' });
    }
  });
}
