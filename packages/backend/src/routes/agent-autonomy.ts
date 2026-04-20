import { FastifyInstance } from 'fastify';
import { analyzeAgentAutonomy } from '../services/agent-autonomy-service.js';

export async function agentAutonomyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/agent-autonomy', async (request, _reply) => {
    const { projectId } = request.params as { projectId: string };
    const metrics = await analyzeAgentAutonomy(projectId);

    const scores = metrics.map(m => m.autonomyScore);
    const avgAutonomyScore =
      scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    const mostAutonomous = metrics.length > 0 ? metrics[0].personaId : '';
    const mostDependent = metrics.length > 0 ? metrics[metrics.length - 1].personaId : '';
    const highAutonomyCount = metrics.filter(m => m.autonomyLevel === 'high').length;

    return {
      agentMetrics: metrics,
      summary: { avgAutonomyScore, mostAutonomous, mostDependent, highAutonomyCount },
    };
  });
}
