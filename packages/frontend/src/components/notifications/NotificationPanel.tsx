import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../api/queries.js';
import { useMarkRead, useMarkAllRead } from '../../api/mutations.js';
import { useNotificationStore } from '../../stores/notification-store.js';
import type { Notification, NotificationType } from '@ai-jam/shared';

const typeIcons: Record<NotificationType, { icon: string; color: string }> = {
  agent_completed: { icon: '\u2713', color: 'text-green-400 bg-green-500/10' },
  ticket_moved: { icon: '\u2192', color: 'text-blue-400 bg-blue-500/10' },
  gate_result: { icon: '\u2691', color: 'text-amber-400 bg-amber-500/10' },
  comment_added: { icon: '\uD83D\uDCAC', color: 'text-indigo-400 bg-indigo-500/10' },
  proposal_created: { icon: '+', color: 'text-purple-400 bg-purple-500/10' },
  proposal_resolved: { icon: '\u2714', color: 'text-teal-400 bg-teal-500/10' },
  scan_completed: { icon: '\uD83D\uDD0D', color: 'text-yellow-400 bg-yellow-500/10' },
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

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        <button
          onClick={handleMarkAllRead}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          Mark all read
        </button>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {!notifications || notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => {
            const ti = typeIcons[n.type] || { icon: '\u2022', color: 'text-gray-400 bg-gray-500/10' };
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 ${
                  n.isRead ? 'opacity-60' : ''
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${ti.color}`}>
                  {ti.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${n.isRead ? 'text-gray-400' : 'text-white font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{relativeTime(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-800">
        <button
          onClick={() => { navigate('/notifications'); onClose(); }}
          className="text-xs text-indigo-400 hover:text-indigo-300 w-full text-center"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
