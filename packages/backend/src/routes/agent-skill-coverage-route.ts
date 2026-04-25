import { FastifyInstance } from 'fastify';
import { analyzeAgentSkillCoverage } from '../services/agent-skill-coverage-service.js';

export async function agentSkillCoverageRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/projects/:projectId/agent-skill-coverage',
    { preHandler: [fastify.authenticate] },
    async (request, _reply) => {
      const { projectId } = request.params as { projectId: string };
      return analyzeAgentSkillCoverage(projectId);
    },
  );
}
