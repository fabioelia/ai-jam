import { FastifyInstance } from 'fastify';
import { triageTicket } from '../services/ticket-triage-service.js';

export async function ticketTriageRoutes(fastify: FastifyInstance) {
  fastify.post('/api/tickets/:ticketId/triage', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };

    const result = await triageTicket(ticketId);
    if (!result) return reply.status(404).send({ error: 'Ticket not found' });
    return result;
  });
}
