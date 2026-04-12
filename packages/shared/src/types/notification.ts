import type { NotificationType } from '../enums.js';

export interface Notification {
  id: string;
  userId: string;
  projectId: string | null;
  featureId: string | null;
  ticketId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  actionUrl: string | null;
  metadata: unknown;
  isRead: number;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  projectId: string | null;
  notificationType: NotificationType;
  enabled: number;
}
