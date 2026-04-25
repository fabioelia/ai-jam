import { FastifyInstance } from 'fastify';
import { analyzeAgentContextWindowUtilization } from '../services/agent-context-window-utilization-analyzer-service.js';

export async function agentContextWindowUtilizationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/projects/:projectId/agent-context-window-utilization-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentContextWindowUtilization();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent context window utilization' });
    }
  });
}
