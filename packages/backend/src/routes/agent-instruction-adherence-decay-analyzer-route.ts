import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionAdherenceDecay } from '../services/agent-instruction-adherence-decay-analyzer-service.js';

export async function agentInstructionAdherenceDecayAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-instruction-adherence-decay-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionAdherenceDecay();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent instruction adherence decay' });
    }
  });
}
