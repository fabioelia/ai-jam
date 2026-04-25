import { FastifyInstance } from 'fastify';
import { analyzeAgentDecisionConfidence } from '../services/agent-decision-confidence-analyzer-service.js';

export async function agentDecisionConfidenceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-decision-confidence-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentDecisionConfidence();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent decision confidence' });
    }
  });
}
