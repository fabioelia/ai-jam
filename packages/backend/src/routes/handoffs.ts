import type { FastifyInstance } from 'fastify';
import { handoffService } from '../services/handoff-service.js';

export async function handoffRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  /**
   * GET /api/tickets/:ticketId/handoffs
   * Get handoff history for a ticket
   */
  fastify.get<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/handoffs',
    async (request, reply) => {
      try {
        const history = await handoffService.getHandoffHistory(request.params.ticketId);
        return reply.send(history);
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to get handoff history' });
      }
    }
  );

  /**
   * GET /api/handoffs/pending
   * Get pending handoffs that need attention
   */
  fastify.get<{
    Querystring: { projectId?: string };
  }>(
    '/api/handoffs/pending',
    async (request, reply) => {
      try {
        const pending = await handoffService.getPendingHandoffs(request.query.projectId);
        return reply.send(pending);
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to get pending handoffs' });
      }
    }
  );

  /**
   * POST /api/tickets/:ticketId/handoffs
   * Execute a handoff with context preservation and intelligent routing
   */
  fastify.post<{
    Params: { ticketId: string };
    Body: {
      fromPersona: string;
      toPersona?: string;
      summary: string;
      implementationDecisions?: string[];
      blockers?: string[];
      fileContext?: string[];
      requestTransition?: boolean;
      manualOverride?: {
        targetPersona?: string;
        targetStatus?: string;
        reason: string;
      };
    };
  }>(
    '/api/tickets/:ticketId/handoffs',
    async (request, reply) => {
      try {
        if (!request.body.fromPersona || !request.body.summary) {
          return reply.status(400).send({ error: 'fromPersona and summary are required' });
        }
        const result = await handoffService.executeHandoff(
          {
            ticketId: request.params.ticketId,
            fromPersona: request.body.fromPersona,
            toPersona: request.body.toPersona,
            summary: request.body.summary,
            implementationDecisions: request.body.implementationDecisions,
            blockers: request.body.blockers,
            fileContext: request.body.fileContext,
          },
          request.body.requestTransition ?? true,
          request.body.manualOverride
        );

        if (result.success) {
          return reply.send(result);
        } else {
          return reply.status(400).send(result);
        }
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to execute handoff' });
      }
    }
  );

  /**
   * POST /api/tickets/:ticketId/handoffs/capture-context
   * Capture context for a ticket (useful before handoff)
   */
  fastify.get<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/handoffs/capture-context',
    async (request, reply) => {
      try {
        const context = await handoffService.captureContext(request.params.ticketId);
        return reply.send(context);
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to capture context' });
      }
    }
  );

  /**
   * GET /api/tickets/:ticketId/handoffs/route
   * Determine next routing decision for a ticket (Phase 2: Intelligent Routing)
   */
  fastify.get<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/handoffs/route',
    async (request, reply) => {
      try {
        const { eq } = await import('drizzle-orm');
        const { db } = await import('../db/connection.js');
        const { tickets } = await import('../db/schema.js');

        const [ticket] = await db.select().from(tickets).where(eq(tickets.id, request.params.ticketId)).limit(1);
        if (!ticket) {
          return reply.status(404).send({ error: 'Ticket not found' });
        }

        // Check for existing manual override
        const manualOverride = await handoffService.getManualOverride(request.params.ticketId) || undefined;

        const route = await handoffService.determineNextRoute(ticket, undefined, manualOverride);
        return reply.send(route);
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to determine route' });
      }
    }
  );

  /**
   * POST /api/tickets/:ticketId/handoffs/override
   * Create a manual routing override for a ticket (Phase 2: Manual Override)
   */
  fastify.post<{
    Params: { ticketId: string };
    Body: {
      targetPersona?: string;
      targetStatus?: string;
      reason: string;
    };
  }>(
    '/api/tickets/:ticketId/handoffs/override',
    async (request, reply) => {
      try {
        const result = await handoffService.createManualOverride(
          request.params.ticketId,
          request.body
        );

        if (result.success) {
          return reply.send(result);
        } else {
          return reply.status(400).send(result);
        }
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to create override' });
      }
    }
  );

  /**
   * POST /api/handoffs/execute
   * Execute a handoff for a specific ticket (used by Orchestrator)
   */
  fastify.post<{
    Body: {
      ticketId: string;
      fromPersona?: string;
      summary?: string;
      requestTransition?: boolean;
      manualOverride?: {
        targetPersona?: string;
        targetStatus?: string;
        reason: string;
      };
    };
  }>(
    '/api/handoffs/execute',
    async (request, reply) => {
      try {
        const { ticketId, summary, requestTransition, manualOverride } = request.body;

        if (!ticketId) {
          return reply.status(400).send({ error: 'ticketId is required' });
        }

        const { eq } = await import('drizzle-orm');
        const { db } = await import('../db/connection.js');
        const { tickets } = await import('../db/schema.js');

        const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
        if (!ticket) {
          return reply.status(404).send({ error: 'Ticket not found' });
        }

        const result = await handoffService.executeHandoff(
          {
            ticketId,
            fromPersona: request.body.fromPersona || ticket.assignedPersona || 'unknown',
            toPersona: undefined,
            summary: summary || `Automatic handoff for ticket "${ticket.title}"`,
          },
          requestTransition ?? true,
          manualOverride
        );

        if (result.success) {
          return reply.send(result);
        } else {
          return reply.status(400).send(result);
        }
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to execute handoff' });
      }
    }
  );

  /**
   * GET /api/projects/:projectId/handoffs/board-state
   * Get board state for workflow awareness (Phase 2: Board State Integration)
   */
  fastify.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/handoffs/board-state',
    async (request, reply) => {
      try {
        const boardState = await handoffService.getBoardState(request.params.projectId);
        return reply.send(boardState);
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to get board state' });
      }
    }
  );

  /**
   * GET /api/tickets/:ticketId/handoffs/complexity
   * Get complexity analysis for a ticket (Phase 2: Complexity Analysis)
   */
  fastify.get<{ Params: { ticketId: string } }>(
    '/api/tickets/:ticketId/handoffs/complexity',
    async (request, reply) => {
      try {
        const { eq } = await import('drizzle-orm');
        const { db } = await import('../db/connection.js');
        const { tickets } = await import('../db/schema.js');

        const [ticket] = await db.select().from(tickets).where(eq(tickets.id, request.params.ticketId)).limit(1);
        if (!ticket) {
          return reply.status(404).send({ error: 'Ticket not found' });
        }

        const complexity = handoffService.analyzeComplexity(ticket);
        const ticketType = handoffService.classifyTicketType(ticket.title, ticket.description ?? undefined);

        return reply.send({ complexity, ticketType });
      } catch (error) {
        return reply.status(500).send({ error: error instanceof Error ? error.message : 'Failed to analyze complexity' });
      }
    }
  );
}
