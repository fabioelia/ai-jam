import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets, projects } from '../db/schema.js';
import { features } from '../db/schema.js';
import {
  createTicketSchema,
  moveTicketSchema,
  updateTicketSchema,
  createClaudeTicketSchema,
  categorizeTicketSchema
} from '@ai-jam/shared';
import { broadcastToBoard } from '../websocket/socket-server.js';
import { getSourceFromRequest } from '../utils/source-header.js';
import { notifyTicketStakeholders } from '../services/notification-service.js';
import { requestGateAwareMove } from '../services/transition-service.js';
import { validateNoCircularDependencies, validateDependencies, cascadeStatusUpdate, getDependencyChain } from '../services/dependency-service.js';
import {
  generateTicketFromPrompt,
  calculateCost,
  categorizeTicket,
  type TicketData,
  type BoardContext
} from '../services/claude-ticket-service.js';
import type { TicketStatus } from '@ai-jam/shared';

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

      // Validate dependencies if provided
      const dependencies = parsed.data.dependencies || [];
      if (dependencies.length > 0) {
        try {
          await validateDependencies(request.params.projectId, dependencies);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.status(400).send({ error: message });
        }
      }

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
        dependencies,
      }).returning();

      broadcastToBoard(request.params.projectId, 'board:ticket:created', { ticket });
      return ticket;
    },
  );

  // Create ticket via Claude (AI-assisted)
  fastify.post<{ Params: { projectId: string }; Body: { stream?: boolean } & Record<string, unknown> }>(
    '/api/projects/:projectId/tickets/claude-create',
    async (request, reply) => {
      const parsed = createClaudeTicketSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const { userId } = request.user;
      const source = getSourceFromRequest(request);
      const { stream } = request.body as { stream?: boolean };

      const [project] = await db.select().from(projects).where(eq(projects.id, request.params.projectId)).limit(1);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      // Check if streaming is requested
      if (stream) {
        reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });

        const fullResponse: string[] = [];

        try {
          const { ticket, usage } = await generateTicketFromPrompt(
            parsed.data.userPrompt,
            parsed.data.attachments || [],
            (delta) => {
              fullResponse.push(delta);
              reply.raw.write(`data: ${JSON.stringify({ delta })}\n\n`);
            },
            parsed.data.codebaseContext
          );

          reply.raw.write(`data: ${JSON.stringify({ done: true, ticket, usage })}\n\n`);
          reply.raw.end();

          return reply.sent;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
          reply.raw.end();
          return reply.sent;
        }
      }

      // Non-streaming response
      try {
        const { ticket: generated, usage } = await generateTicketFromPrompt(
          parsed.data.userPrompt,
          parsed.data.attachments || [],
          undefined,
          parsed.data.codebaseContext
        );

        const cost = calculateCost(usage);

        // Create the ticket in the database
        const [ticket] = await db.insert(tickets).values({
          projectId: request.params.projectId,
          featureId: parsed.data.featureId,
          title: generated.title,
          description: generated.description,
          priority: generated.priority || 'medium',
          storyPoints: generated.storyPoints || null,
          createdBy: userId,
          source: 'claude',
          claudeMessageCount: usage.inputTokens + usage.outputTokens,
          claudeCost: Math.round(cost * 100000), // Store as micro-units
        }).returning();

        broadcastToBoard(request.params.projectId, 'board:ticket:created', { ticket });
        return reply.send({ ticket, usage, cost });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: message });
      }
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

    const ticketId = request.params.id;

    // Get current ticket for validation
    const [currentTicket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!currentTicket) return reply.status(404).send({ error: 'Ticket not found' });

    // Validate dependencies if they're being updated
    if (parsed.data.dependencies !== undefined) {
      // Validate dependencies exist and belong to same project
      if (parsed.data.dependencies.length > 0) {
        try {
          await validateDependencies(currentTicket.projectId, parsed.data.dependencies);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return reply.status(400).send({ error: message });
        }
      }

      // Validate no circular dependencies
      try {
        await validateNoCircularDependencies(ticketId, parsed.data.dependencies);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(400).send({ error: message });
      }
    }

    const [ticket] = await db
      .update(tickets)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();

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

    // Cascade status update for any status change (not just done)
    // This handles unblocking dependents when blockers complete, and re-blocking when blockers fail
    await cascadeStatusUpdate(ticket.id, ticket.projectId, parsed.data.toStatus, current.status).catch((err) => {
      console.error('Error cascading status update:', err);
    });

    broadcastToBoard(ticket.projectId, 'board:ticket:moved', {
      ticketId: ticket.id,
      fromStatus: current.status,
      toStatus: parsed.data.toStatus,
      sortOrder: ticket.sortOrder,
    });

    notifyTicketStakeholders(
      ticket.id,
      'ticket_moved',
      `${ticket.title} moved to ${parsed.data.toStatus}`,
      null,
      `/projects/${ticket.projectId}/board?ticket=${ticket.id}`,
      request.user.userId,
    ).catch(() => {});

    return ticket;
  });

  // Gate-aware move: checks project transition gate settings before executing.
  // Used by agent MCP tools and orchestrator. Returns whether move was immediate or gated.
  fastify.post<{
    Params: { id: string };
    Body: { toStatus: string; requestedBy?: string; agentSessionId?: string };
  }>('/api/tickets/:id/request-move', async (request, reply) => {
    const { toStatus, requestedBy, agentSessionId } = request.body ?? {};
    if (!toStatus) return reply.status(400).send({ error: 'toStatus is required' });

    const source = requestedBy || getSourceFromRequest(request) || 'unknown';

    try {
      const result = await requestGateAwareMove({
        ticketId: request.params.id,
        toStatus: toStatus as TicketStatus,
        requestedBy: source,
        agentSessionId,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
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

  // Get dependency chain for a ticket
  fastify.get<{ Params: { id: string }; Querystring: { maxDepth?: string } }>(
    '/api/tickets/:id/dependency-chain',
    async (request, reply) => {
      const maxDepth = request.query.maxDepth ? parseInt(request.query.maxDepth, 10) : 5;
      const chain = await getDependencyChain(request.params.id, maxDepth);
      return chain;
    }
  );

  // Categorize a ticket using AI
  fastify.post<{ Params: { projectId: string }; Body: { featureId?: string; includeBoardContext?: boolean } & Record<string, unknown> }>(
    '/api/projects/:projectId/tickets/categorize',
    async (request, reply) => {
      const parsed = categorizeTicketSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

      const { title, description, featureId, includeBoardContext } = parsed.data;
      const { projectId } = request.params;

      let boardContext: BoardContext | undefined;

      if (includeBoardContext) {
        // Gather board context if featureId is provided
        if (featureId) {
          const [feature] = await db.select().from(features).where(eq(features.id, featureId)).limit(1);

          if (feature) {
            boardContext = {
              featureTitle: feature.title,
              featureDescription: feature.description || undefined,
            };

            // Get related tickets for the feature
            const relatedTickets = await db
              .select()
              .from(tickets)
              .where(and(eq(tickets.featureId, featureId), eq(tickets.projectId, projectId)))
              .orderBy(tickets.createdAt)
              .limit(5);

            if (relatedTickets.length > 0) {
              boardContext.relatedTickets = relatedTickets.map(t => ({
                title: t.title,
                description: t.description || '',
                status: t.status,
                priority: t.priority,
              }));
            }
          }
        }

        // Get project-level related tickets if no featureId
        if (!boardContext?.relatedTickets) {
          const projectTickets = await db
            .select()
            .from(tickets)
            .where(eq(tickets.projectId, projectId))
            .orderBy(tickets.createdAt)
            .limit(5);

          if (projectTickets.length > 0) {
            if (!boardContext) boardContext = {};
            boardContext.relatedTickets = projectTickets.map(t => ({
              title: t.title,
              description: t.description || '',
              status: t.status,
              priority: t.priority,
            }));
          }
        }
      }

      try {
        const { categorization, usage } = await categorizeTicket(
          { title, description },
          boardContext
        );
        const cost = calculateCost(usage);

        return reply.send({
          categorization,
          usage,
          cost,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: message });
      }
    }
  );
}
