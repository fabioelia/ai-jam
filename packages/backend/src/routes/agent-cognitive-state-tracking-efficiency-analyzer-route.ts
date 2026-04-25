import { FastifyInstance } from 'fastify';
import { analyzeAgentCognitiveStateTrackingEfficiency } from '../services/agent-cognitive-state-tracking-efficiency-analyzer-service';

export async function agentCognitiveStateTrackingEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-cognitive-state-tracking-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentCognitiveStateTrackingEfficiency();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent cognitive state tracking efficiency' });
    }
  });
}
