import { create } from 'zustand';
import type { Notification } from '@ai-jam/shared';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  unreadByProject: Record<string, number>;
  isLoading: boolean;

  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: (projectId?: string) => void;
  setNotifications: (list: Notification[]) => void;
  setUnreadCount: (count: number, byProject?: Record<string, number>) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  unreadByProject: {},
  isLoading: false,

  addNotification: (n) => {
    const { notifications, unreadCount, unreadByProject } = get();
    const isUnread = !n.isRead;
    const nextByProject = { ...unreadByProject };
    if (isUnread && n.projectId) {
      nextByProject[n.projectId] = (nextByProject[n.projectId] ?? 0) + 1;
    }
    set({
      notifications: [n, ...notifications],
      unreadCount: isUnread ? unreadCount + 1 : unreadCount,
      unreadByProject: nextByProject,
    });
  },

  markRead: (id) => {
    const { notifications, unreadCount, unreadByProject } = get();
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    const nextByProject = { ...unreadByProject };
    if (target.projectId && nextByProject[target.projectId]) {
      nextByProject[target.projectId] = Math.max(0, nextByProject[target.projectId] - 1);
    }

    set({
      notifications: notifications.map((n) =>
        n.id === id ? { ...n, isRead: 1 } : n,
      ),
      unreadCount: Math.max(0, unreadCount - 1),
      unreadByProject: nextByProject,
    });
  },

  markAllRead: (projectId?: string) => {
    const { notifications, unreadCount, unreadByProject } = get();
    if (projectId) {
      const projectUnread = unreadByProject[projectId] ?? 0;
      set({
        notifications: notifications.map((n) =>
          n.projectId === projectId ? { ...n, isRead: 1 } : n,
        ),
        unreadCount: Math.max(0, unreadCount - projectUnread),
        unreadByProject: { ...unreadByProject, [projectId]: 0 },
      });
    } else {
      set({
        notifications: notifications.map((n) => ({ ...n, isRead: 1 })),
        unreadCount: 0,
        unreadByProject: {},
      });
    }
  },

  setNotifications: (list) => {
    set({ notifications: list });
  },

  setUnreadCount: (count, byProject) => {
    set({
      unreadCount: count,
      ...(byProject !== undefined && { unreadByProject: byProject }),
    });
  },
}));
