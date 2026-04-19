import { FastifyInstance } from 'fastify';
import { analyzeDeadlineRisk } from '../services/deadline-risk-service.js';

export async function deadlineRiskRoutes(fastify: FastifyInstance) {
  fastify.post('/api/projects/:projectId/deadline-risk', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as { deadlineDate?: string };

    if (!body.deadlineDate) {
      return reply.status(400).send({ error: 'deadlineDate is required' });
    }

    const parsed = new Date(body.deadlineDate);
    if (isNaN(parsed.getTime())) {
      return reply.status(400).send({ error: 'deadlineDate is not a valid date' });
    }

    const result = await analyzeDeadlineRisk(projectId, body.deadlineDate);
    if (!result) return reply.status(404).send({ error: 'Project not found' });
    return result;
  });
}
