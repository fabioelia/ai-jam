import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseCoherence } from '../services/agent-response-coherence-analyzer-service.js';

export async function agentResponseCoherenceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-response-coherence-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentResponseCoherence();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent response coherence' });
    }
  });
}
