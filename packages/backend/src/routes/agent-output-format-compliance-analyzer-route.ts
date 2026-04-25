import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputFormatComplianceAnalyzer } from '../services/agent-output-format-compliance-analyzer-service.js';

export async function agentOutputFormatComplianceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-output-format-compliance-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentOutputFormatComplianceAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent output format compliance' });
    }
  });
}
