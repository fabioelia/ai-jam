import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionInterpretationVariance } from '../services/agent-instruction-interpretation-variance-analyzer-service';

export async function agentInstructionInterpretationVarianceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-instruction-interpretation-variance-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionInterpretationVariance();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent instruction interpretation variance' });
    }
  });
}
