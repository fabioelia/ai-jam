import { FastifyInstance } from 'fastify';
import { analyzeAgentOutputVerbosity } from '../services/agent-output-verbosity-analyzer-service.js';

export async function agentOutputVerbosityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-output-verbosity-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentOutputVerbosity();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent output verbosity' });
    }
  });
}
