import { useEffect } from 'react';
import { getSocket } from '../api/socket.js';
import { useNotificationStore } from '../stores/notification-store.js';

export function useNotificationSync(projectId: string) {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const markRead = useNotificationStore((s) => s.markRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  useEffect(() => {
    if (!projectId) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    // Board room already joined by useBoardSync — no extra join needed

    socket.on('notification:created', ({ notification }) => {
      addNotification(notification);
    });

    socket.on('notification:read', ({ notificationId }) => {
      markRead(notificationId);
    });

    socket.on('notification:count', ({ count }) => {
      setUnreadCount(count);
    });

    return () => {
      socket.off('notification:created');
      socket.off('notification:read');
      socket.off('notification:count');
    };
  }, [projectId, addNotification, markRead, setUnreadCount]);
}
