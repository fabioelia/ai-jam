import { FastifyInstance } from 'fastify';
import { analyzeAgentKnowledgeTransferEfficiency } from '../services/agent-knowledge-transfer-efficiency-analyzer-service.js';

export async function agentKnowledgeTransferEfficiencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-knowledge-transfer-efficiency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentKnowledgeTransferEfficiency();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent knowledge transfer efficiency' });
    }
  });
}
