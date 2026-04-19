import { FastifyInstance } from 'fastify';
import { scoreTicketQuality } from '../services/ticket-quality-service.js';

export async function ticketQualityRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/quality',
    async (request, reply) => {
      const { ticketId } = request.params;
      try {
        const result = await scoreTicketQuality(ticketId);
        return reply.code(200).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: message });
      }
    }
  );
}
