import { FastifyInstance } from 'fastify';
import { analyzeAgentResourceEfficiency } from '../services/agent-resource-efficiency-analyzer-service.js';

export async function agentResourceEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-resource-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentResourceEfficiency();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent resource efficiency' });
    }
  });
}
