import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { notifications } from '../db/schema.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // List notifications for a project with filters
  fastify.get<{
    Params: { projectId: string };
    Querystring: { featureId?: string; type?: string; isRead?: string; limit?: string; offset?: string };
  }>('/api/projects/:projectId/notifications', async (request) => {
    const { projectId } = request.params;
    const { featureId, type, isRead, limit, offset } = request.query;

    const conditions = [eq(notifications.projectId, projectId)];

    if (type) {
      conditions.push(eq(notifications.type, type));
    }
    if (isRead !== undefined) {
      conditions.push(eq(notifications.isRead, isRead === 'true' ? 1 : 0));
    }
    // featureId filter — requires featureId column from schema migration ticket
    if (featureId && 'featureId' in notifications) {
      conditions.push(eq((notifications as any).featureId, featureId));
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .limit(limit ? parseInt(limit, 10) : 50)
      .offset(offset ? parseInt(offset, 10) : 0)
      .orderBy(sql`${notifications.createdAt} desc`);

    return rows;
  });

  // Unread count for a project
  fastify.get<{
    Params: { projectId: string };
    Querystring: { featureId?: string };
  }>('/api/projects/:projectId/notifications/unread-count', async (request) => {
    const { projectId } = request.params;
    const { featureId } = request.query;

    const conditions = [
      eq(notifications.projectId, projectId),
      eq(notifications.isRead, 0),
    ];

    if (featureId && 'featureId' in notifications) {
      conditions.push(eq((notifications as any).featureId, featureId));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    return { count: result.count };
  });

  // Mark single notification as read
  fastify.patch<{ Params: { notificationId: string } }>(
    '/api/notifications/:notificationId/read',
    async (request, reply) => {
      const [notification] = await db
        .update(notifications)
        .set({ isRead: 1 })
        .where(eq(notifications.id, request.params.notificationId))
        .returning();

      if (!notification) return reply.status(404).send({ error: 'Notification not found' });
      return notification;
    },
  );

  // Mark all notifications as read for a project (optionally scoped by featureId)
  fastify.patch<{
    Params: { projectId: string };
    Querystring: { featureId?: string };
  }>('/api/projects/:projectId/notifications/read-all', async (request) => {
    const { projectId } = request.params;
    const { featureId } = request.query;

    const conditions = [
      eq(notifications.projectId, projectId),
      eq(notifications.isRead, 0),
    ];

    if (featureId && 'featureId' in notifications) {
      conditions.push(eq((notifications as any).featureId, featureId));
    }

    const updated = await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(and(...conditions))
      .returning();

    return { updated: updated.length };
  });
}
