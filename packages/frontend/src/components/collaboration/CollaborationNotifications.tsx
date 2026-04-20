import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification, User } from '@ai-jam/shared';
import { getSocket } from '../../api/socket.js';
import { formatDistanceToNow } from 'date-fns';

interface CollaborationNotificationsProps {
  currentUserId: string;
  notifications?: Notification[];
  users?: User[];
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
  onDismiss?: (notificationId: string) => Promise<void>;
  onNotificationClick?: (notification: Notification) => void;
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

type NotificationFilter = 'all' | 'mentions' | 'assignments' | 'comments' | 'gates';
type NotificationGroup = 'unread' | 'read' | 'earlier';

interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  timestamp: number;
  userId?: string;
  userName?: string;
  userAvatar?: string | null;
  metadata?: Record<string, unknown>;
}

export default function CollaborationNotifications({
  currentUserId,
  notifications = [],
  users = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onNotificationClick,
  maxVisible = 5,
  position = 'top-right',
}: CollaborationNotificationsProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [group, setGroup] = useState<NotificationGroup>('unread');
  const [realtimeNotifications, setRealtimeNotifications] = useState<RealtimeNotification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const prevNotificationsRef = useRef<Notification[]>([]);

  // Filter notifications
  const filteredNotifications = useCallback((): Notification[] => {
    let filtered = notifications.filter((n) => !dismissedIds.has(n.id));

    if (filter === 'mentions') {
      filtered = filtered.filter((n) =>
        n.type === 'mention' || (n.body && n.body.includes('@'))
      );
    } else if (filter === 'assignments') {
      filtered = filtered.filter((n) =>
        n.type === 'assignment' || n.type === 'reassignment'
      );
    } else if (filter === 'comments') {
      filtered = filtered.filter((n) =>
        n.type === 'comment' || n.type === 'reply'
      );
    } else if (filter === 'gates') {
      filtered = filtered.filter((n) =>
        n.type === 'gate:approved' || n.type === 'gate:rejected'
      );
    }

    if (group === 'unread') {
      filtered = filtered.filter((n) => !n.isRead);
    } else if (group === 'read') {
      filtered = filtered.filter((n) => n.isRead);
    }

    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, filter, group, dismissedIds]);

  // Handle real-time notifications
  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const connectSocket = () => {
      try {
        socket = getSocket();
        setupSocketListeners();
      } catch (err) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          setTimeout(connectSocket, 2000 * reconnectAttempts);
        }
      }
    };

    const setupSocketListeners = () => {
      if (!socket) return;

      // Listen for new notifications
      socket.on('notification:created', ({ notification }) => {
        if (notification.userId === currentUserId) {
          const realtimeNotif: RealtimeNotification = {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            timestamp: new Date(notification.createdAt).getTime(),
            metadata: notification.metadata as Record<string, unknown>,
          };

          setRealtimeNotifications((prev) => [realtimeNotif, ...prev].slice(0, maxVisible));

          // Auto-dismiss after 5 seconds
          setTimeout(() => {
            setRealtimeNotifications((prev) =>
              prev.filter((n) => n.id !== realtimeNotif.id)
            );
          }, 5000);
        }
      });

      // Listen for notification read updates
      socket.on('notification:read', ({ notificationId, userId }) => {
        if (userId === currentUserId) {
          // Will be handled by parent's data update
        }
      });

      // Listen for notification count updates
      socket.on('notification:count', ({ count }) => {
        // Can be used to update unread count badge
      });
    };

    connectSocket();

    return () => {
      if (socket) {
        socket.off('notification:created');
        socket.off('notification:read');
        socket.off('notification:count');
      }
    };
  }, [currentUserId, maxVisible]);

  // Detect new notifications for animation
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const prevIds = new Set(prevNotificationsRef.current.map((n) => n.id));
    const newIds = [...currentIds].filter((id) => !prevIds.has(id));

    prevNotificationsRef.current = notifications;
  }, [notifications]);

  // Get notification icon
  const getNotificationIcon = useCallback((notification: Notification) => {
    switch (notification.type) {
      case 'mention':
        return (
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
      case 'assignment':
        return (
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'reassignment':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        );
      case 'comment':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case 'reply':
        return (
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
        );
      case 'gate:approved':
        return (
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'gate:rejected':
        return (
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  }, []);

  // Get notification color
  const getNotificationColor = useCallback((notification: Notification) => {
    switch (notification.type) {
      case 'mention':
        return 'text-indigo-400';
      case 'assignment':
        return 'text-green-400';
      case 'reassignment':
        return 'text-amber-400';
      case 'comment':
        return 'text-blue-400';
      case 'reply':
        return 'text-purple-400';
      case 'gate:approved':
        return 'text-green-400';
      case 'gate:rejected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead && !dismissedIds.has(n.id)).length;
  const visibleNotifications = filteredNotifications().slice(0, maxVisible);

  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  return (
    <>
      {/* Real-time Toast Notifications */}
      <div className={`fixed ${getPositionClasses()} z-50 space-y-2 pointer-events-none`}>
        {realtimeNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              pointer-events-auto bg-gray-900 border border-gray-700 rounded-lg shadow-2xl
              animate-in slide-in-from-top duration-300 p-4 w-80
              ${!notification.isRead ? 'border-l-4 border-l-indigo-500' : ''}
            `}
          >
            <div className="flex items-start gap-3">
              {getNotificationIcon(notification as Notification)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{notification.title}</p>
                {notification.body && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.body}</p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  {formatRelativeTime(new Date(notification.timestamp).toISOString())}
                </p>
              </div>
              <button
                onClick={() => setRealtimeNotifications((prev) => prev.filter((n) => n.id !== notification.id))}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notification Bell / Trigger */}
      <div className="relative">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="relative p-2 text-gray-400 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Panel */}
        {showPanel && (
          <div
            ref={containerRef}
            className="absolute right-0 top-10 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 animate-in zoom-in-95 duration-150 max-h-[500px] flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && onMarkAllAsRead && (
                    <button
                      onClick={() => onMarkAllAsRead()}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowPanel(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {(['all', 'unread', 'read'] as NotificationGroup[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`
                      text-xs px-2.5 py-1 rounded-full transition-colors
                      ${group === g
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                      }
                    `}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {visibleNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {visibleNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => onNotificationClick?.(notification)}
                      className={`
                        px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer
                        ${!notification.isRead ? 'bg-indigo-500/5' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{notification.title}</p>
                          {notification.body && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.body}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-gray-600">
                              {formatRelativeTime(notification.createdAt)}
                            </span>
                            {onMarkAsRead && !notification.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkAsRead(notification.id);
                                }}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                        {onDismiss && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss(notification.id);
                              setDismissedIds((prev) => new Set([...prev, notification.id]));
                            }}
                            className="text-gray-500 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {visibleNotifications.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-700 bg-gray-900/50">
                <p className="text-[10px] text-gray-600 text-center">
                  Showing {visibleNotifications.length} of {filteredNotifications().length} notifications
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
