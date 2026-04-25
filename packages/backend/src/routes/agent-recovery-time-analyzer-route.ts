import { FastifyInstance } from 'fastify';
import { analyzeAgentRecoveryTimeAnalyzer } from '../services/agent-recovery-time-analyzer-service.js';

export async function agentRecoveryTimeAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-recovery-time-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentRecoveryTimeAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent recovery time' });
    }
  });
}
