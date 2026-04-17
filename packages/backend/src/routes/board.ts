import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets, epics, features } from '../db/schema.js';
import { TICKET_STATUS_ORDER } from '@ai-jam/shared';
import { getBlockedTickets, isTicketBlocked } from '../services/dependency-service.js';

export async function boardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // Get full board state for a project
  fastify.get<{ Params: { projectId: string }; Querystring: { featureId?: string } }>(
    '/api/projects/:projectId/board',
    async (request) => {
      const conditions = [eq(tickets.projectId, request.params.projectId)];
      if (request.query.featureId) {
        conditions.push(eq(tickets.featureId, request.query.featureId));
      }

      const allTickets = await db.select().from(tickets).where(
        request.query.featureId
          ? eq(tickets.featureId, request.query.featureId)
          : eq(tickets.projectId, request.params.projectId),
      );

      // Get all epics for features in this project
      const projectFeatures = await db.select({ id: features.id }).from(features).where(eq(features.projectId, request.params.projectId));
      const featureIds = projectFeatures.map((f) => f.id);

      let allEpics: (typeof epics.$inferSelect)[] = [];
      if (featureIds.length > 0) {
        // Get epics for all features in the project
        const epicResults = await Promise.all(
          featureIds.map((fId) => db.select().from(epics).where(eq(epics.featureId, fId))),
        );
        allEpics = epicResults.flat();
      }

      const columns = TICKET_STATUS_ORDER.map((status) => ({
        status,
        tickets: allTickets
          .filter((t) => t.status === status)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));

      return { columns, epics: allEpics };
    },
  );

  // Get tickets blocked by a specific ticket (inverse of dependencies)
  fastify.get<{ Params: { id: string } }>('/api/tickets/:id/blocks', async (request, reply) => {
    const blockedTicketIds = await getBlockedTickets(request.params.id);
    const blockedTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, blockedTicketIds[0]));

    // Need to fetch all blocked tickets
    const allBlocked = await Promise.all(
      blockedTicketIds.map((id) => db.select().from(tickets).where(eq(tickets.id, id)).limit(1))
    );

    return { blocks: allBlocked.map((result) => result[0]).filter(Boolean) };
  });

  // Check if a ticket is blocked by its dependencies
  fastify.get<{ Params: { id: string } }>('/api/tickets/:id/blocked-status', async (request, reply) => {
    const isBlocked = await isTicketBlocked(request.params.id);
    return { blocked: isBlocked };
  });
}
