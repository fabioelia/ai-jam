import { FastifyInstance } from 'fastify';
import { analyzeAgentPromptSensitivity } from '../services/agent-prompt-sensitivity-analyzer-service.js';

export async function agentPromptSensitivityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-prompt-sensitivity-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentPromptSensitivity();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent prompt sensitivity' });
    }
  });
}
