import { FastifyInstance } from 'fastify';
import { analyzeEpicHealth } from '../services/epic-health-service.js';

export async function epicHealthRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { epicId: string } }>(
    '/api/epics/:epicId/health',
    async (request, reply) => {
      const result = await analyzeEpicHealth(request.params.epicId);
      if (!result) {
        return reply.status(404).send({ error: 'Epic not found' });
      }
      return reply.send(result);
    }
  );
}
