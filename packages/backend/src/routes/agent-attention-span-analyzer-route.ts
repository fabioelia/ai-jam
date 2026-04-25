import { FastifyInstance } from 'fastify';
import { analyzeAgentAttentionSpanAnalyzer } from '../services/agent-attention-span-analyzer-service.js';

export async function agentAttentionSpanAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-attention-span-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentAttentionSpanAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent attention span' });
    }
  });
}
