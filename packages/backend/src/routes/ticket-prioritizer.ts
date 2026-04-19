import { FastifyInstance } from 'fastify';
import { prioritizeTickets } from '../services/ticket-prioritizer-service.js';

export async function ticketPrioritizerRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/prioritize',
    async (request, reply) => {
      const result = await prioritizeTickets(request.params.projectId);
      return reply.send(result);
    }
  );
}
