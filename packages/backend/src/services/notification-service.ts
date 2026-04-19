import { db } from '../db/connection.js';
import { notifications, notificationPreferences, projectMembers, tickets, comments as commentsTable, features, projects } from '../db/schema.js';
import { eq, and, ne, desc, count } from 'drizzle-orm';
import { broadcastToUser } from '../websocket/socket-server.js';
import type { Notification } from '@ai-jam/shared';

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
 * Respects notification_preferences — skips if user disabled this type for this project.
 */
export async function createNotification(params: CreateNotificationParams) {
  // Check if user has disabled this notification type for this project
  const [pref] = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, params.userId),
        eq(notificationPreferences.projectId, params.projectId),
        eq(notificationPreferences.notificationType, params.type),
      ),
    )
    .limit(1);

  if (pref && pref.enabled === 0) {
    return null;
  }

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

  broadcastToUser(params.userId, 'notification:created', { notification });

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

/**
 * Notify ticket creator + assigned user, excluding the actor.
 * Returns the set of notified user IDs (for deduplication with other notify calls).
 */
export async function notifyTicketStakeholders(
  ticketId: string,
  type: string,
  title: string,
  body: string | null,
  actionUrl: string | null,
  actorUserId: string,
): Promise<string[]> {
  const [ticket] = await db
    .select({
      projectId: tickets.projectId,
      featureId: tickets.featureId,
      createdBy: tickets.createdBy,
      assignedUserId: tickets.assignedUserId,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) return [];

  const recipientIds = [...new Set(
    [ticket.createdBy, ticket.assignedUserId].filter(
      (id): id is string => !!id && id !== actorUserId,
    ),
  )];

  await Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        userId,
        projectId: ticket.projectId,
        type,
        title,
        body: body ?? undefined,
        actionUrl: actionUrl ?? undefined,
        featureId: ticket.featureId ?? undefined,
        ticketId,
      }),
    ),
  );

  return recipientIds;
}

/**
 * Notify prior commenters on a ticket, excluding the actor and any already-notified users.
 * Returns the set of notified user IDs.
 */
export async function notifyTicketCommenters(
  ticketId: string,
  excludeUserId: string,
  type: string,
  title: string,
  body: string | null,
  actionUrl: string | null,
  skipUserIds: string[] = [],
): Promise<string[]> {
  const [ticket] = await db
    .select({ projectId: tickets.projectId, featureId: tickets.featureId })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) return [];

  const rows = await db
    .selectDistinct({ userId: commentsTable.userId })
    .from(commentsTable)
    .where(
      and(
        eq(commentsTable.ticketId, ticketId),
        ne(commentsTable.userId, excludeUserId),
      ),
    );

  const skipSet = new Set(skipUserIds);
  const recipientIds = rows
    .map((r) => r.userId)
    .filter((id) => !skipSet.has(id));

  await Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        userId,
        projectId: ticket.projectId,
        type,
        title,
        body: body ?? undefined,
        actionUrl: actionUrl ?? undefined,
        featureId: ticket.featureId ?? undefined,
        ticketId,
      }),
    ),
  );

  return recipientIds;
}

/**
 * Notify the creator of a feature.
 */
export async function notifyFeatureCreator(
  featureId: string,
  type: string,
  title: string,
  body?: string,
  actionUrl?: string,
) {
  const [feature] = await db
    .select({ projectId: features.projectId, createdBy: features.createdBy })
    .from(features)
    .where(eq(features.id, featureId))
    .limit(1);

  if (!feature) return null;

  return createNotification({
    userId: feature.createdBy,
    projectId: feature.projectId,
    type,
    title,
    body,
    actionUrl,
    featureId,
  });
}

/**
 * Notify the owner of a project.
 */
export async function notifyProjectOwner(
  projectId: string,
  type: string,
  title: string,
  body?: string,
  actionUrl?: string,
) {
  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;

  return createNotification({
    userId: project.ownerId,
    projectId,
    type,
    title,
    body,
    actionUrl,
  });
}

// ---------------------------------------------------------------------------
// Handoff Notification Functions (Phase 3: Notification System)
// ---------------------------------------------------------------------------

export interface HandoffNotificationMetadata {
  fromPersona: string;
  toPersona?: string;
  ticketTitle: string;
  ticketPriority: string;
  ticketType?: string;
  complexity?: string;
  manualOverride?: boolean;
  routingReason?: string;
  transitionFrom?: string;
  transitionTo?: string;
}

/**
 * Send a handoff received notification to target persona.
 * Notifies recipient that a ticket has been handed off to them.
 */
export async function notifyHandoffReceived(
  ticketId: string,
  fromPersona: string,
  toPersona: string,
  metadata: HandoffNotificationMetadata,
): Promise<string[]> {
  const [ticket] = await db
    .select({
      projectId: tickets.projectId,
      featureId: tickets.featureId,
      title: tickets.title,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) return [];

  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, ticket.projectId));

  const notifiedUserIds: string[] = [];

  await Promise.all(
    members.map(async (member) => {
      const notification = await createNotification({
        userId: member.userId,
        projectId: ticket.projectId,
        type: 'handoff_received',
        title: `Handoff Received: ${fromPersona} → ${toPersona}`,
        body: `Ticket "${ticket.title}" has been handed off from ${fromPersona} to ${toPersona}. ${metadata.routingReason || ''}`,
        actionUrl: `/projects/${ticket.projectId}/tickets/${ticketId}`,
        featureId: ticket.featureId ?? undefined,
        ticketId,
        metadata: {
          ...metadata,
          fromPersona,
          toPersona,
          ticketTitle: ticket.title,
        },
      });

      if (notification) {
        notifiedUserIds.push(member.userId);
      }
    }),
  );

  return notifiedUserIds;
}

/**
 * Send a handoff completed notification.
 * Notifies stakeholders that a handoff has been successfully completed.
 */
export async function notifyHandoffCompleted(
  ticketId: string,
  fromPersona: string,
  toPersona: string,
  metadata: HandoffNotificationMetadata,
): Promise<string[]> {
  const [ticket] = await db
    .select({
      projectId: tickets.projectId,
      featureId: tickets.featureId,
      title: tickets.title,
      assignedUserId: tickets.assignedUserId,
      createdBy: tickets.createdBy,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) return [];

  const recipientIds = [...new Set(
    [ticket.createdBy, ticket.assignedUserId].filter((id): id is string => !!id),
  )];

  const notifiedUserIds: string[] = [];

  await Promise.all(
    recipientIds.map(async (userId) => {
      const notification = await createNotification({
        userId,
        projectId: ticket.projectId,
        type: 'handoff_completed',
        title: `Handoff Completed: ${fromPersona} → ${toPersona}`,
        body: `Handoff for ticket "${ticket.title}" has been completed. ${metadata.routingReason || ''}`,
        actionUrl: `/projects/${ticket.projectId}/tickets/${ticketId}`,
        featureId: ticket.featureId ?? undefined,
        ticketId,
        metadata: {
          ...metadata,
          fromPersona,
          toPersona,
          ticketTitle: ticket.title,
        },
      });

      if (notification) {
        notifiedUserIds.push(userId);
      }
    }),
  );

  return notifiedUserIds;
}

/**
 * Send a handoff failed notification.
 * Notifies stakeholders that a handoff has failed and needs attention.
 */
export async function notifyHandoffFailed(
  ticketId: string,
  fromPersona: string,
  error: string,
  metadata: Partial<HandoffNotificationMetadata>,
): Promise<string[]> {
  const [ticket] = await db
    .select({
      projectId: tickets.projectId,
      featureId: tickets.featureId,
      title: tickets.title,
      assignedUserId: tickets.assignedUserId,
      createdBy: tickets.createdBy,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) return [];

  const recipientIds = [...new Set(
    [ticket.createdBy, ticket.assignedUserId].filter((id): id is string => !!id),
  )];

  const notifiedUserIds: string[] = [];

  await Promise.all(
    recipientIds.map(async (userId) => {
      const notification = await createNotification({
        userId,
        projectId: ticket.projectId,
        type: 'handoff_failed',
        title: `Handoff Failed: ${fromPersona}`,
        body: `Handoff for ticket "${ticket.title}" failed. Error: ${error}`,
        actionUrl: `/projects/${ticket.projectId}/tickets/${ticketId}`,
        featureId: ticket.featureId ?? undefined,
        ticketId,
        metadata: {
          ...metadata,
          fromPersona,
          ticketTitle: ticket.title,
          error,
        },
      });

      if (notification) {
        notifiedUserIds.push(userId);
      }
    }),
  );

  return notifiedUserIds;
}

/**
 * Send a manual override created notification.
 * Notifies relevant users that a manual routing override has been created.
 */
export async function notifyHandoffOverrideCreated(
  ticketId: string,
  override: { targetPersona?: string; targetStatus?: string; reason: string },
  metadata: Partial<HandoffNotificationMetadata>,
): Promise<string[]> {
  const [ticket] = await db
    .select({
      projectId: tickets.projectId,
      featureId: tickets.featureId,
      title: tickets.title,
      assignedUserId: tickets.assignedUserId,
      createdBy: tickets.createdBy,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  if (!ticket) return [];

  const members = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, ticket.projectId));

  const notifiedUserIds: string[] = [];

  await Promise.all(
    members.map(async (member) => {
      const notification = await createNotification({
        userId: member.userId,
        projectId: ticket.projectId,
        type: 'handoff_override_created',
        title: `Manual Override Created: ${ticket.title}`,
        body: `Manual routing override created for ticket "${ticket.title}". Reason: ${override.reason}${override.targetPersona ? ` Target: ${override.targetPersona}` : ''}${override.targetStatus ? ` Status: ${override.targetStatus}` : ''}`,
        actionUrl: `/projects/${ticket.projectId}/tickets/${ticketId}`,
        featureId: ticket.featureId ?? undefined,
        ticketId,
        metadata: {
          ...metadata,
          ticketTitle: ticket.title,
          targetPersona: override.targetPersona,
          targetStatus: override.targetStatus,
          overrideReason: override.reason,
        },
      });

      if (notification) {
        notifiedUserIds.push(member.userId);
      }
    }),
  );

  return notifiedUserIds;
}
