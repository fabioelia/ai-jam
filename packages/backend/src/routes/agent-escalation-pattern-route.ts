import { FastifyInstance } from 'fastify';
import { analyzeAgentEscalationPatterns } from '../services/agent-escalation-pattern-service.js';
import { db } from '../db/connection.js';

export async function agentEscalationPatternAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-escalation-patterns', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    return analyzeAgentEscalationPatterns(db as any, projectId);
  });
}
