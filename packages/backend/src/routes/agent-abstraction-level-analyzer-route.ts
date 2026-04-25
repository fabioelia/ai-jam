import { FastifyInstance } from 'fastify';
import { analyzeAgentAbstractionLevelAnalyzer } from '../services/agent-abstraction-level-analyzer-service.js';

export async function agentAbstractionLevelAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-abstraction-level-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentAbstractionLevelAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent abstraction level' });
    }
  });
}
