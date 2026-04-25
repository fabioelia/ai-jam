import { FastifyInstance } from 'fastify';
import { analyzeAgentReasoningTransparencyAnalyzer } from '../services/agent-reasoning-transparency-analyzer-service.js';

export async function agentReasoningTransparencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-reasoning-transparency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentReasoningTransparencyAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent reasoning transparency' });
    }
  });
}
