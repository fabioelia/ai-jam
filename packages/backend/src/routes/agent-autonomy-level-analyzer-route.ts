import { FastifyInstance } from 'fastify';
import { analyzeAgentAutonomyLevel } from '../services/agent-autonomy-level-analyzer-service.js';

export async function agentAutonomyLevelAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-autonomy-level-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentAutonomyLevel();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent autonomy level' });
    }
  });
}
