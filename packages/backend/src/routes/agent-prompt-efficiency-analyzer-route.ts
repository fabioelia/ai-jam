import { FastifyInstance } from 'fastify';
import { analyzeAgentPromptEfficiencyAnalyzer } from '../services/agent-prompt-efficiency-analyzer-service.js';

export async function agentPromptEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-prompt-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentPromptEfficiencyAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent prompt efficiency' });
    }
  });
}
