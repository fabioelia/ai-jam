import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionClarityScore } from '../services/agent-instruction-clarity-score-analyzer-service.js';

export async function agentInstructionClarityScoreAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-instruction-clarity-score-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentInstructionClarityScore(projectId);
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent instruction clarity score' });
    }
  });
}
