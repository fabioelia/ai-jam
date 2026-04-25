import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionParseAccuracy } from '../services/agent-instruction-parse-accuracy-analyzer-service.js';

export async function agentInstructionParseAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-instruction-parse-accuracy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionParseAccuracy();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction parse accuracy' });
    }
  });
}
