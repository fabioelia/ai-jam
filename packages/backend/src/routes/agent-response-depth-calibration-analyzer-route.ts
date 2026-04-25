import { FastifyInstance } from 'fastify';
import { analyzeAgentResponseDepthCalibration } from '../services/agent-response-depth-calibration-analyzer-service';

export async function agentResponseDepthCalibrationAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-response-depth-calibration-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentResponseDepthCalibration();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent response depth calibration' });
    }
  });
}
