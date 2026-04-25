import { FastifyInstance } from 'fastify';
import { analyzeAgentErrorRecoverySpeed } from '../services/agent-error-recovery-speed-analyzer-service.js';

export async function agentErrorRecoverySpeedAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-error-recovery-speed-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentErrorRecoverySpeed();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent error recovery speed' });
    }
  });
}
