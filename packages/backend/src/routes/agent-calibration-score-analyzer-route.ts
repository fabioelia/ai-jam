import { FastifyInstance } from 'fastify';
import { analyzeAgentCalibrationScoreAnalyzer } from '../services/agent-calibration-score-analyzer-service.js';

export async function agentCalibrationScoreAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-calibration-score-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentCalibrationScoreAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent calibration score' });
    }
  });
}
