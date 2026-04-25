import { FastifyInstance } from 'fastify';
import { analyzeAgentInitiativeCalibrationAnalyzer } from '../services/agent-initiative-calibration-analyzer-service.js';

export async function agentInitiativeCalibrationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.post('/projects/:projectId/agent-initiative-calibration-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentInitiativeCalibrationAnalyzer();
      return reply.send(report);
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to analyze agent initiative calibration' });
    }
  });
}
