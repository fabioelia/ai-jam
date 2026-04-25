import { FastifyInstance } from 'fastify';
import { analyzeAgentLearningCurve } from '../services/agent-learning-curve-analyzer-service.js';

export async function agentLearningCurveAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-learning-curve-analyzer',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentLearningCurve(projectId);
    },
  );
}
