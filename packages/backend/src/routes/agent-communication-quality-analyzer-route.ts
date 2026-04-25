import { FastifyInstance } from 'fastify';
import { analyzeAgentCommunicationQualityAnalyzer } from '../services/agent-communication-quality-analyzer-service';

export async function agentCommunicationQualityAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-communication-quality-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentCommunicationQualityAnalyzer(projectId);
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent communication quality' });
    }
  });
}
