import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionDisambiguationRateAnalyzer } from '../services/agent-instruction-disambiguation-rate-analyzer-service.js';

export async function agentInstructionDisambiguationRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-instruction-disambiguation-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionDisambiguationRateAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction disambiguation rate' });
    }
  });
}
