import { create } from 'zustand';
import type { Notification } from '@ai-jam/shared';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setNotifications: (list: Notification[]) => void;
  setUnreadCount: (n: number) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    set({
      notifications: [n, ...get().notifications],
      unreadCount: get().unreadCount + 1,
    });
  },

  markRead: (id) => {
    const { notifications, unreadCount } = get();
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    set({
      notifications: notifications.map((n) =>
        n.id === id ? { ...n, isRead: 1 } : n,
      ),
      unreadCount: Math.max(0, unreadCount - 1),
    });
  },

  markAllRead: () => {
    set({
      notifications: get().notifications.map((n) => ({ ...n, isRead: 1 })),
      unreadCount: 0,
    });
  },

  setNotifications: (list) => {
    set({ notifications: list });
  },

  setUnreadCount: (n) => {
    set({ unreadCount: n });
  },
}));
