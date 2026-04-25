import { FastifyInstance } from 'fastify';
import { analyzeAgentNarrativeCoherence } from '../services/agent-narrative-coherence-analyzer-service.js';

export async function agentNarrativeCoherenceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-narrative-coherence-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentNarrativeCoherence();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent narrative coherence' });
    }
  });
}
