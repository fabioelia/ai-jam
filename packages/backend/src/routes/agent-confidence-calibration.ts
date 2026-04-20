import { FastifyInstance } from 'fastify';
import { analyzeAgentConfidenceCalibration } from '../services/agent-confidence-calibration-service.js';

export async function agentConfidenceCalibrationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-confidence-calibration', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await analyzeAgentConfidenceCalibration(projectId);
    return result;
  });
}
