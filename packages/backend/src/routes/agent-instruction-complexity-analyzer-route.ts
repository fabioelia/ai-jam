import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionComplexity } from '../services/agent-instruction-complexity-analyzer-service.js';

export async function agentInstructionComplexityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/projects/:projectId/agent-instruction-complexity-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionComplexity();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction complexity' });
    }
  });
}
