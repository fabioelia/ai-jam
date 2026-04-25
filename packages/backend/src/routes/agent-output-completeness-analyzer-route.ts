import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputCompletenessAnalyzer } from '../services/agent-output-completeness-analyzer-service.js';

export async function agentOutputCompletenessAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-output-completeness-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentOutputCompletenessAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent output completeness' });
    }
  });
}
