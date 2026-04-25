import { FastifyInstance } from 'fastify';
import { analyzeAgentInstructionExecutionLatency } from '../services/agent-instruction-execution-latency-analyzer-service';

export async function agentInstructionExecutionLatencyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-instruction-execution-latency-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInstructionExecutionLatency();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent instruction execution latency' });
    }
  });
}
