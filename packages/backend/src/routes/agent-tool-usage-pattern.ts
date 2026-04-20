import { FastifyInstance } from 'fastify';
import { analyzeAgentToolUsagePattern } from '../services/agent-tool-usage-pattern-service.js';

export async function agentToolUsagePatternRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-tool-usage-pattern', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentToolUsagePattern(parseInt(projectId, 10) || 0);
    return result;
  });
}
