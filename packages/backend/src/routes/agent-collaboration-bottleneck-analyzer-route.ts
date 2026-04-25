import { FastifyInstance } from 'fastify';
import { analyzeAgentCollaborationBottleneckAnalyzer } from '../services/agent-collaboration-bottleneck-analyzer-service.js';

export async function agentCollaborationBottleneckAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-collaboration-bottleneck-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentCollaborationBottleneckAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent collaboration bottleneck' });
    }
  });
}
