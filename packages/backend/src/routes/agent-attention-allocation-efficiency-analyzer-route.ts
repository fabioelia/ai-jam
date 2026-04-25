import { FastifyInstance } from 'fastify';
import { analyzeAgentAttentionAllocationEfficiency } from '../services/agent-attention-allocation-efficiency-analyzer-service';

export async function agentAttentionAllocationEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-attention-allocation-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentAttentionAllocationEfficiency();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent attention allocation efficiency' });
    }
  });
}
