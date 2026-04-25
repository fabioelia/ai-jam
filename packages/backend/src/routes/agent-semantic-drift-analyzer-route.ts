import { FastifyInstance } from 'fastify';
import { analyzeAgentSemanticDrift } from '../services/agent-semantic-drift-analyzer-service.js';

export async function agentSemanticDriftAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-semantic-drift-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSemanticDrift();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent semantic drift' });
    }
  });
}
