import { FastifyInstance } from 'fastify';
import { generateSprintPlan } from '../services/sprint-planning-service.js';

export async function sprintPlanningRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/sprint-plan',
    async (request, reply) => {
      const { projectId } = request.params;
      try {
        const result = await generateSprintPlan(projectId);
        return reply.code(200).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: message });
      }
    }
  );
}
