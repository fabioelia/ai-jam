import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseCalibrationDriftAnalyzer } from '../services/agent-response-calibration-drift-analyzer-service';

export async function agentResponseCalibrationDriftAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-response-calibration-drift-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentResponseCalibrationDriftAnalyzer();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent response calibration drift' });
    }
  });
}
