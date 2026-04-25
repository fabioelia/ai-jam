import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputDiversityAnalyzer } from '../services/agent-output-diversity-analyzer-service.js';

export async function agentOutputDiversityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-output-diversity-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentOutputDiversityAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent output diversity' });
    }
  });
}
