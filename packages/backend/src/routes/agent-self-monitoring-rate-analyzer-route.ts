import { FastifyInstance } from 'fastify';
import { analyzeAgentSelfMonitoringRate } from '../services/agent-self-monitoring-rate-analyzer-service';

export async function agentSelfMonitoringRateAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-self-monitoring-rate-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentSelfMonitoringRate();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent self-monitoring rate' });
    }
  });
}
