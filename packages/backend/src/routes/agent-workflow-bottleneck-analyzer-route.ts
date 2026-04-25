import { FastifyInstance } from 'fastify';
import { analyzeAgentWorkflowBottleneckAnalyzer } from '../services/agent-workflow-bottleneck-analyzer-service.js';

export async function agentWorkflowBottleneckAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-workflow-bottleneck-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentWorkflowBottleneckAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze workflow bottleneck' });
    }
  });
}
