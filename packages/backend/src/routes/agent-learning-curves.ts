import type { FastifyInstance } from 'fastify';
import { analyzeAgentLearningCurves } from '../services/agent-learning-curve-service.js';

export async function agentLearningCurvesRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { projectId: string } }>(
    '/api/agent-learning-curves/:projectId',
    async (request, reply) => {
      const { projectId } = request.params;
      const report = await analyzeAgentLearningCurves(projectId);
      return reply.send(report);
    },
  );
}
