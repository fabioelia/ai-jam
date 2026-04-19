import { FastifyInstance } from 'fastify';
import { generateStandupReport } from '../services/standup-report-service.js';

export async function standupRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/standup',
    async (request, reply) => {
      const { projectId } = request.params;
      try {
        const result = await generateStandupReport(projectId);
        return reply.code(200).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: message });
      }
    }
  );
}
