import { FastifyInstance } from 'fastify';
import { analyzeDependencies } from '../services/blocker-dependency-service.js';

export async function blockerDependencyRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/dependencies',
    async (request, reply) => {
      const { projectId } = request.params;
      try {
        const result = await analyzeDependencies(projectId);
        return reply.code(200).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: message });
      }
    }
  );
}
