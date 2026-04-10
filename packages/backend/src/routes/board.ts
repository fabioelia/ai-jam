import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { tickets, epics, features } from '../db/schema.js';
import { TICKET_STATUS_ORDER } from '@ai-jam/shared';

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
}
