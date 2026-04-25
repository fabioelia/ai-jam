import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionFollowingFidelityAnalyzer } from '../services/agent-instruction-following-fidelity-analyzer-service.js';

export async function agentInstructionFollowingFidelityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-instruction-following-fidelity-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionFollowingFidelityAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction following fidelity' });
    }
  });
}
