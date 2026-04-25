import { FastifyInstance } from 'fastify';
import { analyzeAgentAdaptationSpeedAnalyzer } from '../services/agent-adaptation-speed-analyzer-service.js';

export async function agentAdaptationSpeedAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-adaptation-speed-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentAdaptationSpeedAnalyzer(projectId);
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent adaptation speed' });
    }
  });
}
