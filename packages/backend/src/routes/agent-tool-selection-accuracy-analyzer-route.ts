import { FastifyInstance } from 'fastify';
import { analyzeAgentToolSelectionAccuracy } from '../services/agent-tool-selection-accuracy-analyzer-service.js';

export async function agentToolSelectionAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-tool-selection-accuracy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentToolSelectionAccuracy();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent tool selection accuracy' });
    }
  });
}
