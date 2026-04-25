import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseLatencyAnalyzer } from '../services/agent-response-latency-analyzer-service.js';

export async function agentResponseLatencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-response-latency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentResponseLatencyAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent response latency' });
    }
  });
}
