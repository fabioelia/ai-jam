import { FastifyInstance } from 'fastify';
import { analyzeAgentMultiStepPlanningAccuracy } from '../services/agent-multi-step-planning-accuracy-analyzer-service';

export async function agentMultiStepPlanningAccuracyAnalyzerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/projects/:projectId/agent-multi-step-planning-accuracy-analyzer', async (request, reply) => {
    try {
      const report = await analyzeAgentMultiStepPlanningAccuracy();
      return reply.send(report);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to analyze agent multi-step planning accuracy' });
    }
  });
}
