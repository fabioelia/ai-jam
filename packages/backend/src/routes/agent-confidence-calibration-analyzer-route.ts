import { FastifyInstance } from 'fastify';
import { analyzeAgentConfidenceCalibrationAnalyzer } from '../services/agent-confidence-calibration-analyzer-service.js';

export async function agentConfidenceCalibrationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-confidence-calibration-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentConfidenceCalibrationAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent confidence calibration' });
    }
  });
}
