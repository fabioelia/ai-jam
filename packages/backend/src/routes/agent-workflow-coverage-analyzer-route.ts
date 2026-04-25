import { FastifyInstance } from 'fastify';
import { analyzeAgentWorkflowCoverage } from '../services/agent-workflow-coverage-analyzer-service.js';

export async function agentWorkflowCoverageAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-workflow-coverage-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentWorkflowCoverage();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent workflow coverage' });
    }
  });
}
