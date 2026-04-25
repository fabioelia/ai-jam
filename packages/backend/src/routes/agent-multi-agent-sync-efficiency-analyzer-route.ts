import { FastifyInstance } from 'fastify';
import { analyzeAgentMultiAgentSyncEfficiencyAnalyzer } from '../services/agent-multi-agent-sync-efficiency-analyzer-service.js';

export async function agentMultiAgentSyncEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-multi-agent-sync-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentMultiAgentSyncEfficiencyAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent multi-agent sync efficiency' });
    }
  });
}
