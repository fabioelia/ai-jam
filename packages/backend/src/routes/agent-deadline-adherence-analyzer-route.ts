import { FastifyInstance } from 'fastify';
import { analyzeAgentDeadlineAdherenceAnalyzer } from '../services/agent-deadline-adherence-analyzer-service.js';

export async function agentDeadlineAdherenceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-deadline-adherence-analyzer',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentDeadlineAdherenceAnalyzer(projectId);
    },
  );
}
