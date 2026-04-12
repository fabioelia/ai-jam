import type { FastifyInstance } from 'fastify';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { notifications, notificationPreferences } from '../db/schema.js';
import { broadcastToUser } from '../websocket/socket-server.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate);

  // GET /api/notifications — list user notifications with optional filters
  fastify.get<{
    Querystring: { projectId?: string; type?: string; unreadOnly?: string; limit?: string; offset?: string };
  }>('/api/notifications', async (request) => {
    const { userId } = request.user;
    const { projectId, type, unreadOnly, limit, offset } = request.query;

    const conditions = [eq(notifications.userId, userId)];
    if (projectId) {
      conditions.push(eq(notifications.projectId, projectId));
    }
    if (type) {
      conditions.push(eq(notifications.type, type));
    }
    if (unreadOnly === 'true') {
      conditions.push(eq(notifications.isRead, 0));
    }

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit ? parseInt(limit, 10) : 50)
      .offset(offset ? parseInt(offset, 10) : 0);
  });

  // GET /api/notifications/unread-count — total + per-project breakdown
  fastify.get('/api/notifications/unread-count', async (request) => {
    const { userId } = request.user;

    const rows = await db
      .select({
        projectId: notifications.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)))
      .groupBy(notifications.projectId);

    const byProject: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      if (row.projectId) {
        byProject[row.projectId] = row.count;
      }
      total += row.count;
    }

    return { count: total, byProject };
  });

  // PATCH /api/notifications/:id/read — mark single notification read
  fastify.patch<{ Params: { id: string } }>(
    '/api/notifications/:id/read',
    async (request, reply) => {
      const { userId } = request.user;

      const [notification] = await db
        .update(notifications)
        .set({ isRead: 1 })
        .where(and(eq(notifications.id, request.params.id), eq(notifications.userId, userId)))
        .returning();

      if (!notification) return reply.status(404).send({ error: 'Notification not found' });

      broadcastToUser(userId, 'notification:read', { notificationId: notification.id, userId });
      return notification;
    },
  );

  // POST /api/notifications/read-all — mark all notifications read
  fastify.post<{ Body: { projectId?: string } }>(
    '/api/notifications/read-all',
    async (request) => {
      const { userId } = request.user;
      const { projectId } = request.body ?? {};

      const conditions = [eq(notifications.userId, userId), eq(notifications.isRead, 0)];
      if (projectId) {
        conditions.push(eq(notifications.projectId, projectId));
      }

      const updated = await db
        .update(notifications)
        .set({ isRead: 1 })
        .where(and(...conditions))
        .returning();

      broadcastToUser(userId, 'notification:read-all', { userId, projectId });
      return { updated: updated.length };
    },
  );

  // DELETE /api/notifications/:id — delete single notification
  fastify.delete<{ Params: { id: string } }>(
    '/api/notifications/:id',
    async (request, reply) => {
      const { userId } = request.user;

      const result = await db
        .delete(notifications)
        .where(and(eq(notifications.id, request.params.id), eq(notifications.userId, userId)))
        .returning();

      if (result.length === 0) return reply.status(404).send({ error: 'Notification not found' });
      return { ok: true };
    },
  );

  // DELETE /api/notifications/read — bulk delete all read notifications
  fastify.delete<{ Body: { projectId?: string } }>(
    '/api/notifications/read',
    async (request) => {
      const { userId } = request.user;
      const { projectId } = request.body ?? {};

      const conditions = [eq(notifications.userId, userId), eq(notifications.isRead, 1)];
      if (projectId) {
        conditions.push(eq(notifications.projectId, projectId));
      }

      const deleted = await db
        .delete(notifications)
        .where(and(...conditions))
        .returning();

      return { deleted: deleted.length };
    },
  );

  // ── Project-scoped notification endpoints (ticket spec) ─────────────────

  // GET /api/projects/:projectId/notifications — paginated list with filters
  fastify.get<{
    Params: { projectId: string };
    Querystring: { featureId?: string; type?: string; isRead?: string; limit?: string; offset?: string };
  }>('/api/projects/:projectId/notifications', async (request) => {
    const { userId } = request.user;
    const { projectId } = request.params;
    const { featureId, type, isRead, limit, offset } = request.query;

    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.projectId, projectId),
    ];
    if (featureId) conditions.push(eq(notifications.featureId, featureId));
    if (type) conditions.push(eq(notifications.type, type));
    if (isRead !== undefined) conditions.push(eq(notifications.isRead, isRead === 'true' ? 1 : 0));

    const take = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset ?? '0', 10) || 0, 0);

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(take)
      .offset(skip);
  });

  // GET /api/projects/:projectId/notifications/unread-count
  fastify.get<{
    Params: { projectId: string };
    Querystring: { featureId?: string };
  }>('/api/projects/:projectId/notifications/unread-count', async (request) => {
    const { userId } = request.user;
    const { projectId } = request.params;
    const { featureId } = request.query;

    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.projectId, projectId),
      eq(notifications.isRead, 0),
    ];
    if (featureId) conditions.push(eq(notifications.featureId, featureId));

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    return { count: row?.count ?? 0 };
  });

  // PATCH /api/projects/:projectId/notifications/read-all — bulk mark read, optional featureId
  fastify.patch<{
    Params: { projectId: string };
    Querystring: { featureId?: string };
  }>('/api/projects/:projectId/notifications/read-all', async (request) => {
    const { userId } = request.user;
    const { projectId } = request.params;
    const { featureId } = request.query;

    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.projectId, projectId),
      eq(notifications.isRead, 0),
    ];
    if (featureId) conditions.push(eq(notifications.featureId, featureId));

    const updated = await db
      .update(notifications)
      .set({ isRead: 1 })
      .where(and(...conditions))
      .returning();

    broadcastToUser(userId, 'notification:read-all', { userId, projectId, featureId });
    return { updated: updated.length };
  });

  // ── Notification preferences ──────────────────────────────────────────

  // GET /api/projects/:projectId/notification-preferences
  fastify.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/notification-preferences',
    async (request) => {
      const { userId } = request.user;

      const rows = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.projectId, request.params.projectId),
          ),
        );

      const preferences: Record<string, boolean> = {};
      for (const row of rows) {
        preferences[row.notificationType] = row.enabled === 1;
      }

      return { preferences };
    },
  );

  // PUT /api/projects/:projectId/notification-preferences — upsert preferences
  fastify.put<{ Params: { projectId: string }; Body: { preferences: Record<string, boolean> } }>(
    '/api/projects/:projectId/notification-preferences',
    async (request, reply) => {
      const { userId } = request.user;
      const { projectId } = request.params;
      const { preferences } = request.body ?? {};

      if (!preferences || typeof preferences !== 'object') {
        return reply.status(400).send({ error: 'preferences object is required' });
      }

      await Promise.all(
        Object.entries(preferences).map(([type, enabled]) =>
          db
            .insert(notificationPreferences)
            .values({
              userId,
              projectId,
              notificationType: type,
              enabled: enabled ? 1 : 0,
            })
            .onConflictDoUpdate({
              target: [
                notificationPreferences.userId,
                notificationPreferences.projectId,
                notificationPreferences.notificationType,
              ],
              set: { enabled: enabled ? 1 : 0 },
            }),
        ),
      );

      // Return updated state
      const rows = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.projectId, projectId),
          ),
        );

      const result: Record<string, boolean> = {};
      for (const row of rows) {
        result[row.notificationType] = row.enabled === 1;
      }

      return { preferences: result };
    },
  );
}
