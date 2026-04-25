import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionRedundancyAnalyzer } from '../services/agent-instruction-redundancy-analyzer-service.js';

export async function agentInstructionRedundancyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-instruction-redundancy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionRedundancyAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction redundancy' });
    }
  });
}
