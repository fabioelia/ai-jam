import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { createTicketSchema, moveTicketSchema, updateTicketSchema } from '@ai-jam/shared';
import { broadcastToBoard } from '../websocket/socket-server.js';
import { getSourceFromRequest } from '../utils/source-header.js';
import { notifyProjectMembers } from '../services/notification-service.js';

export async function ticketRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List tickets for a project (optionally filter by status, epicId)
  fastify.get<{ Params: { projectId: string }; Querystring: { status?: string; epicId?: string; featureId?: string } }>(
    '/api/projects/:projectId/tickets',
    async (request) => {
      const conditions = [eq(tickets.projectId, request.params.projectId)];
      if (request.query.status) {
        conditions.push(eq(tickets.status, request.query.status as 'backlog'));
      }
      if (request.query.epicId) {
        conditions.push(eq(tickets.epicId, request.query.epicId));
      }
      if (request.query.featureId) {
        conditions.push(eq(tickets.featureId, request.query.featureId));
      }
      return db.select().from(tickets).where(and(...conditions));
    },
  );

  // Create ticket
  fastify.post<{ Params: { projectId: string }; Body: { featureId: string } & Record<string, unknown> }>(
    '/api/projects/:projectId/tickets',
    async (request, reply) => {
      const parsed = createTicketSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const featureId = (request.body as Record<string, unknown>).featureId as string;
      if (!featureId) return reply.status(400).send({ error: 'featureId is required' });

      const { userId } = request.user;
      const source = getSourceFromRequest(request);
      const [ticket] = await db.insert(tickets).values({
        projectId: request.params.projectId,
        featureId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        epicId: parsed.data.epicId || null,
        priority: parsed.data.priority || 'medium',
        storyPoints: parsed.data.storyPoints || null,
        createdBy: userId,
        source,
      }).returning();

      broadcastToBoard(request.params.projectId, 'board:ticket:created', { ticket });
      return ticket;
    },
  );

  // Get single ticket
  fastify.get<{ Params: { id: string } }>('/api/tickets/:id', async (request, reply) => {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, request.params.id)).limit(1);
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });
    return ticket;
  });

  // Update ticket
  fastify.patch<{ Params: { id: string } }>('/api/tickets/:id', async (request, reply) => {
    const parsed = updateTicketSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const [ticket] = await db.update(tickets).set({ ...parsed.data, updatedAt: new Date() }).where(eq(tickets.id, request.params.id)).returning();
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

    broadcastToBoard(ticket.projectId, 'board:ticket:updated', { ticketId: ticket.id, changes: parsed.data });
    return ticket;
  });

  // Move ticket (change status column)
  fastify.post<{ Params: { id: string } }>('/api/tickets/:id/move', async (request, reply) => {
    const parsed = moveTicketSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    // Get current ticket to know the from status
    const [current] = await db.select().from(tickets).where(eq(tickets.id, request.params.id)).limit(1);
    if (!current) return reply.status(404).send({ error: 'Ticket not found' });

    const updates: Record<string, unknown> = {
      status: parsed.data.toStatus,
      updatedAt: new Date(),
    };
    if (parsed.data.sortOrder !== undefined) {
      updates.sortOrder = parsed.data.sortOrder;
    }

    const [ticket] = await db.update(tickets).set(updates).where(eq(tickets.id, request.params.id)).returning();

    broadcastToBoard(ticket.projectId, 'board:ticket:moved', {
      ticketId: ticket.id,
      fromStatus: current.status,
      toStatus: parsed.data.toStatus,
      sortOrder: ticket.sortOrder,
    });

    const persona = current.assignedPersona || getSourceFromRequest(request) || 'unknown';
    notifyProjectMembers({
      projectId: ticket.projectId,
      type: 'ticket_moved',
      title: `${ticket.title} moved to ${parsed.data.toStatus}`,
      body: `Ticket moved from ${current.status} to ${parsed.data.toStatus} by ${persona}`,
      actionUrl: `/projects/${ticket.projectId}/board?ticket=${ticket.id}`,
      featureId: ticket.featureId ?? undefined,
      ticketId: ticket.id,
      metadata: { fromStatus: current.status, toStatus: parsed.data.toStatus, persona },
    }).catch(() => {});

    return ticket;
  });

  // Reorder ticket within column
  fastify.post<{ Params: { id: string }; Body: { sortOrder: number } }>('/api/tickets/:id/reorder', async (request, reply) => {
    const { sortOrder } = request.body as { sortOrder: number };
    const [ticket] = await db.update(tickets).set({ sortOrder, updatedAt: new Date() }).where(eq(tickets.id, request.params.id)).returning();
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

    broadcastToBoard(ticket.projectId, 'board:ticket:updated', { ticketId: ticket.id, changes: { sortOrder } });
    return ticket;
  });

  // Delete ticket
  fastify.delete<{ Params: { id: string } }>('/api/tickets/:id', async (request, reply) => {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, request.params.id)).limit(1);
    if (!ticket) return reply.status(404).send({ error: 'Ticket not found' });

    await db.delete(tickets).where(eq(tickets.id, request.params.id));
    broadcastToBoard(ticket.projectId, 'board:ticket:deleted', { ticketId: ticket.id });
    return { ok: true };
  });
}
