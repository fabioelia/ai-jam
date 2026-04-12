import { db } from '../db/connection.js';
import { notifications, projectMembers } from '../db/schema.js';
import { eq, and, desc, count } from 'drizzle-orm';
import { broadcastToBoard } from '../websocket/socket-server.js';

interface CreateNotificationParams {
  userId: string;
  projectId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  featureId?: string;
  ticketId?: string;
  metadata?: Record<string, unknown>;
}

interface GetNotificationsOpts {
  featureId?: string;
  type?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Insert a notification and broadcast via Socket.IO.
 */
export async function createNotification(params: CreateNotificationParams) {
  const [notification] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      projectId: params.projectId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      actionUrl: params.actionUrl ?? null,
      featureId: params.featureId ?? null,
      ticketId: params.ticketId ?? null,
      metadata: params.metadata ?? null,
    })
    .returning();

  broadcastToBoard(params.projectId, 'notification:created', notification);

  return notification;
}

/**
 * Query notifications with optional filters and pagination.
 * Ordered by createdAt desc.
 */
export async function getNotifications(projectId: string, opts: GetNotificationsOpts = {}) {
  const conditions = [eq(notifications.projectId, projectId)];

  if (opts.featureId) {
    conditions.push(eq(notifications.featureId, opts.featureId));
  }

  if (opts.type) {
    conditions.push(eq(notifications.type, opts.type));
  }

  if (opts.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, opts.isRead ? 1 : 0));
  }

  const query = db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt));

  if (opts.limit) {
    query.limit(opts.limit);
  }
  if (opts.offset) {
    query.offset(opts.offset);
  }

  return query;
}

/**
 * Mark a single notification as read for a specific user.
 */
export async function markRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
      )
    )
    .returning();

  return updated;
}

/**
 * Bulk mark all notifications as read, optionally scoped to feature.
 */
export async function markAllRead(projectId: string, userId: string, featureId?: string) {
  const conditions = [
    eq(notifications.projectId, projectId),
    eq(notifications.userId, userId),
    eq(notifications.isRead, 0),
  ];

  if (featureId) {
    conditions.push(eq(notifications.featureId, featureId));
  }

  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(and(...conditions));
}

/**
 * Count unread notifications for badge display.
 */
export async function getUnreadCount(projectId: string, userId: string, featureId?: string) {
  const conditions = [
    eq(notifications.projectId, projectId),
    eq(notifications.userId, userId),
    eq(notifications.isRead, 0),
  ];

  if (featureId) {
    conditions.push(eq(notifications.featureId, featureId));
  }

  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(...conditions));

  return result?.count ?? 0;
}

interface NotifyProjectMembersParams {
  projectId: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  featureId?: string;
  ticketId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for every member of a project.
 */
export async function notifyProjectMembers(params: NotifyProjectMembersParams) {
  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, params.projectId));

  const results = await Promise.all(
    members.map((m) =>
      createNotification({ ...params, userId: m.userId }),
    ),
  );

  return results;
}
