import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { transitionGates, tickets } from '../db/schema.js';
import {
  requestTransition,
  approveTransition,
  rejectTransition,
  getTransitionGates,
} from '../services/transition-service.js';
import { notifyTicketStakeholders } from '../services/notification-service.js';
import type { TicketStatus } from '@ai-jam/shared';

export async function transitionGateRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List gates for a ticket
  fastify.get<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/gates',
    async (request) => {
      return getTransitionGates(request.params.ticketId);
    }
  );

  // Create a transition gate (used by agent-runtime gatekeeper)
  fastify.post<{
    Body: {
      ticketId: string;
      fromStatus: string;
      toStatus: string;
      gatekeeperPersona: string;
      agentSessionId?: string;
    };
  }>('/api/transition-gates', async (request, reply) => {
    const { ticketId, fromStatus, toStatus, gatekeeperPersona, agentSessionId } = request.body;

    try {
      const gateId = await requestTransition(
        ticketId,
        fromStatus as TicketStatus,
        toStatus as TicketStatus,
        gatekeeperPersona,
        agentSessionId,
      );

      const [gate] = await db
        .select()
        .from(transitionGates)
        .where(eq(transitionGates.id, gateId));

      return gate;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  // Approve a gate
  fastify.post<{ Params: { id: string } }>(
    '/api/transition-gates/:id/approve',
    async (request, reply) => {
      try {
        const [gate] = await db
          .select()
          .from(transitionGates)
          .where(eq(transitionGates.id, request.params.id));
        if (!gate) return reply.status(404).send({ error: 'Gate not found' });

        await approveTransition(request.params.id);

        const [ticket] = await db
          .select({ projectId: tickets.projectId })
          .from(tickets)
          .where(eq(tickets.id, gate.ticketId));

        if (ticket) {
          notifyTicketStakeholders(
            gate.ticketId,
            'gate_result',
            `Gate approved: ${gate.fromStatus} → ${gate.toStatus}`,
            null,
            `/projects/${ticket.projectId}/board?ticket=${gate.ticketId}`,
            request.user.userId,
          ).catch(() => {});
        }

        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Reject a gate
  fastify.post<{ Params: { id: string }; Body: { feedback: string } }>(
    '/api/transition-gates/:id/reject',
    async (request, reply) => {
      const { feedback } = request.body;
      if (!feedback) return reply.status(400).send({ error: 'feedback is required' });

      try {
        const [gate] = await db
          .select()
          .from(transitionGates)
          .where(eq(transitionGates.id, request.params.id));
        if (!gate) return reply.status(404).send({ error: 'Gate not found' });

        await rejectTransition(request.params.id, feedback);

        const [ticket] = await db
          .select({ projectId: tickets.projectId })
          .from(tickets)
          .where(eq(tickets.id, gate.ticketId));

        if (ticket) {
          notifyTicketStakeholders(
            gate.ticketId,
            'gate_result',
            `Gate rejected: ${gate.fromStatus} → ${gate.toStatus}`,
            feedback,
            `/projects/${ticket.projectId}/board?ticket=${gate.ticketId}`,
            request.user.userId,
          ).catch(() => {});
        }

        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: message });
      }
    }
  );
}
