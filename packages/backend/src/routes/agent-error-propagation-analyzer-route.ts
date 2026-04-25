import { FastifyInstance } from 'fastify';
import { analyzeAgentErrorPropagation } from '../services/agent-error-propagation-analyzer-service.js';

export async function agentErrorPropagationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-error-propagation-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentErrorPropagation();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent error propagation' });
    }
  });
}
