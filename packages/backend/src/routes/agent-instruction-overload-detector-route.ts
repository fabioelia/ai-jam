import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionOverloadDetector } from '../services/agent-instruction-overload-detector-service';

export async function agentInstructionOverloadDetectorRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-instruction-overload-detector', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionOverloadDetector();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent instruction overload' });
    }
  });
}
