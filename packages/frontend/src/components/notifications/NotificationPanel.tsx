import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../../api/queries.js';
import { useMarkRead, useMarkAllRead } from '../../api/mutations.js';
import { useNotificationStore } from '../../stores/notification-store.js';
import type { Notification, NotificationType } from '@ai-jam/shared';

const typeIcons: Record<NotificationType, { icon: string; color: string; svg: string }> = {
  agent_completed: { icon: '\u2713', color: 'text-green-400 bg-green-500/10', svg: 'M5 13l4 4L19 7' },
  ticket_moved: { icon: '\u2192', color: 'text-blue-400 bg-blue-500/10', svg: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  gate_result: { icon: '\u2691', color: 'text-amber-400 bg-amber-500/10', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  comment_added: { icon: '\uD83D\uDCAC', color: 'text-indigo-400 bg-indigo-500/10', svg: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  proposal_created: { icon: '+', color: 'text-purple-400 bg-purple-500/10', svg: 'M12 4v16m8-8H4' },
  proposal_resolved: { icon: '\u2714', color: 'text-teal-400 bg-teal-500/10', svg: 'M9 12l2 2 4-4' },
  scan_completed: { icon: '\uD83D\uDD0D', color: 'text-yellow-400 bg-yellow-500/10', svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
};

function relativeTime(date: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export default function NotificationPanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications(projectId, { limit: 20 });
  const markReadMutation = useMarkRead(projectId);
  const markAllReadMutation = useMarkAllRead(projectId);
  const storeMarkRead = useNotificationStore((s) => s.markRead);
  const storeMarkAllRead = useNotificationStore((s) => s.markAllRead);
  const panelRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!notifications || notifications.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, notifications.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        handleClick(notifications[focusedIndex]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [notifications, focusedIndex, onClose]);

  function handleClick(n: Notification) {
    if (!n.isRead) {
      storeMarkRead(n.id);
      markReadMutation.mutate(n.id);
    }
    if (n.actionUrl) {
      navigate(n.actionUrl);
      onClose();
    }
  }

  function handleMarkAllRead() {
    storeMarkAllRead();
    markAllReadMutation.mutate();
  }

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-full sm:w-96 max-w-sm sm:max-w-none bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-right"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-indigo-400 hover:text-indigo-300 active:text-indigo-200 transition-colors hover:shadow-sm hover:shadow-indigo-500/10 active:scale-95"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {!notifications || notifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 animate-in scale-in duration-300">
              <svg className="w-6 h-6 text-gray-600 animate-in fade-in duration-300 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 animate-in fade-in duration-300 delay-200">No notifications yet</p>
            <p className="text-xs text-gray-600 mt-1 animate-in fade-in duration-300 delay-300">You'll see updates here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {notifications.map((n, index) => {
              const ti = typeIcons[n.type] || {
                icon: '\u2022',
                color: 'text-gray-400 bg-gray-500/10',
                svg: 'M12 4v16m8-8H4',
              };
              const isFocused = index === focusedIndex;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-800/50 active:bg-gray-700/50 transition-all duration-200 ${
                    n.isRead ? 'opacity-60' : ''
                  } ${isFocused ? 'bg-gray-800/70' : ''}`}
                  aria-label={`${n.title}, ${relativeTime(n.createdAt)}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ti.color}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={ti.svg} />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${n.isRead ? 'text-gray-400' : 'text-white font-medium'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-500 truncate mt-0.5 line-clamp-1">{n.body}</p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1.5">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
        <button
          onClick={() => { navigate('/notifications'); onClose(); }}
          className="text-xs text-indigo-400 hover:text-indigo-300 w-full text-center py-2 rounded-lg hover:bg-indigo-500/10 hover:shadow-sm active:bg-indigo-500/20 active:scale-95 transition-all duration-200"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
