import { FastifyInstance } from 'fastify';
import { analyzeAgentCapabilityBoundaryAwarenessAnalyzer } from '../services/agent-capability-boundary-awareness-analyzer-service.js';

export async function agentCapabilityBoundaryAwarenessAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-capability-boundary-awareness-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentCapabilityBoundaryAwarenessAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent capability boundary awareness' });
    }
  });
}
