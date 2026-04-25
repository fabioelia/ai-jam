import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionAdherence } from '../services/agent-instruction-adherence-analyzer-service';

export async function agentInstructionAdherenceAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-instruction-adherence-analyzer', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const report = await analyzeAgentInstructionAdherence(projectId);
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction adherence' });
    }
  });
}
