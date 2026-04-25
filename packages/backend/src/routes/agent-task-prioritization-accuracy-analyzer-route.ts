import { FastifyInstance } from 'fastify';
import { analyzeAgentTaskPrioritizationAccuracy } from '../services/agent-task-prioritization-accuracy-analyzer-service.js';

export async function agentTaskPrioritizationAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-task-prioritization-accuracy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentTaskPrioritizationAccuracy();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent task prioritization accuracy' });
    }
  });
}
