import { FastifyInstance } from 'fastify';
import { analyzeAgentDependencyRisk } from '../services/agent-dependency-risk-analyzer-service.js';

export async function agentDependencyRiskAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-dependency-risk-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentDependencyRisk();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent dependency risk' });
    }
  });
}
