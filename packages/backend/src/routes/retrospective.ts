import { FastifyInstance } from 'fastify';
import { generateRetrospective } from '../services/retrospective-service.js';

export async function retrospectiveRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/retrospective',
    async (request, reply) => {
      const { projectId } = request.params;
      try {
        const result = await generateRetrospective(projectId);
        return reply.code(200).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: message });
      }
    }
  );
}
