import { FastifyInstance } from 'fastify';
import { analyzeAgentDecisionLatencyAnalyzer } from '../services/agent-decision-latency-analyzer-service.js';

export async function agentDecisionLatencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-decision-latency-analyzer', {
    preHandler: [fastify.authenticate],
  }, async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentDecisionLatencyAnalyzer(projectId);
  });
}
