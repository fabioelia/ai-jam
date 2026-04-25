import { FastifyInstance } from 'fastify';
import { analyzeAgentPromptAlignmentScore } from '../services/agent-prompt-alignment-score-analyzer-service';

export async function agentPromptAlignmentScoreAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-prompt-alignment-score-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentPromptAlignmentScore();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent prompt alignment score' });
    }
  });
}
