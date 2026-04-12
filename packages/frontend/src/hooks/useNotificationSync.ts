import { useEffect } from 'react';
import { getSocket, joinUser, leaveUser } from '../api/socket.js';
import { useNotificationStore } from '../stores/notification-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { apiFetch } from '../api/client.js';

interface UnreadCountResponse {
  count: number;
  byProject: Record<string, number>;
}

export function useNotificationSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  useEffect(() => {
    if (!userId) return;

    // Fetch initial unread count
    apiFetch<UnreadCountResponse>('/notifications/unread-count')
      .then(({ count, byProject }) => {
        setUnreadCount(count, byProject);
      })
      .catch(() => {
        // Silently fail — count will update via socket events
      });

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    joinUser(userId);

    socket.on('notification:created', ({ notification }) => {
      addNotification(notification);
    });

    socket.on('notification:read', ({ notificationId }) => {
      markRead(notificationId);
    });

    socket.on('notification:read-all', ({ projectId }) => {
      markAllRead(projectId);
    });

    socket.on('notification:count', ({ count }) => {
      setUnreadCount(count);
    });

    return () => {
      leaveUser(userId);
      socket.off('notification:created');
      socket.off('notification:read');
      socket.off('notification:read-all');
      socket.off('notification:count');
    };
  }, [userId, addNotification, markRead, markAllRead, setUnreadCount]);
}
