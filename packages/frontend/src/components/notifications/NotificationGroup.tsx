import { useState } from 'react';
import type { Notification } from '@ai-jam/shared';
import { NotificationType } from '@ai-jam/shared';

const typeIcons: Record<NotificationType, { icon: string; color: string; label: string; svg: string }> = {
  agent_completed: { icon: '✓', color: 'text-green-400 bg-green-500/10', label: 'Agent completed', svg: 'M5 13l4 4L19 7' },
  ticket_moved: { icon: '→', color: 'text-blue-400 bg-blue-500/10', label: 'Ticket moved', svg: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  gate_result: { icon: '⚑', color: 'text-amber-400 bg-amber-500/10', label: 'Gate result', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  comment_added: { icon: '💬', color: 'text-indigo-400 bg-indigo-500/10', label: 'Comment added', svg: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  proposal_created: { icon: '+', color: 'text-purple-400 bg-purple-500/10', label: 'Proposal created', svg: 'M12 4v16m8-8H4' },
  proposal_resolved: { icon: '✔', color: 'text-teal-400 bg-teal-500/10', label: 'Proposal resolved', svg: 'M9 12l2 2 4-4' },
  scan_completed: { icon: '🔍', color: 'text-yellow-400 bg-yellow-500/10', label: 'Scan completed', svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
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

interface NotificationGroupProps {
  groupName: string;
  notifications: Notification[];
  onNotificationClick: (n: Notification) => void;
  onGroupAction?: (type: 'markRead' | 'delete') => void;
  focusedIndex: number;
  globalIndexStart: number;
  getProjectName: (projectId: string | null) => string | null;
  searchQuery?: string;
  highlightMatch?: (text: string) => React.ReactNode;
}

export default function NotificationGroup({
  groupName,
  notifications,
  onNotificationClick,
  onGroupAction,
  focusedIndex,
  globalIndexStart,
  getProjectName,
  searchQuery,
  highlightMatch,
}: NotificationGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="mb-4 animate-slide-in-from-bottom">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-2 mb-2 text-left transition-all duration-200 hover:bg-gray-800/50 rounded-lg group"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {groupName}
          </h3>
          <span className="text-xs text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
            {notifications.length}
          </span>
          {unreadCount > 0 && (
            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              {unreadCount} new
            </span>
          )}
        </div>
        {onGroupAction && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGroupAction('markRead');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-all duration-200"
              title="Mark all in group as read"
            >
              Mark read
            </button>
          </div>
        )}
      </button>

      {/* Group Content */}
      {isExpanded && (
        <div className="space-y-1 animate-group-expand">
          {notifications.map((n, index) => {
            const ti = typeIcons[n.type] || {
              icon: '•',
              color: 'text-gray-400 bg-gray-500/10',
              label: n.type,
              svg: 'M12 4v16m8-8H4',
            };
            const projectName = getProjectName(n.projectId);
            const globalIndex = globalIndexStart + index;
            const isFocused = focusedIndex === globalIndex;
            const isUnread = !n.isRead;

            return (
              <button
                key={n.id}
                onClick={() => onNotificationClick(n)}
                role="listitem"
                className={`w-full text-left px-4 py-3 flex gap-3 items-start rounded-xl border transition-all duration-200 ${
                  isUnread
                    ? 'bg-gray-900/80 border-gray-700 hover:bg-gray-800/80 hover:border-gray-600 hover:shadow-md hover:shadow-gray-900/10 hover:-translate-y-0.5 active:bg-gray-800/90 active:scale-[0.995] animate-notification-scale-in'
                    : 'bg-gray-900/30 border-gray-800/50 hover:bg-gray-800/50 hover:border-gray-700/50 hover:shadow-md hover:shadow-gray-900/10 hover:-translate-y-0.5 active:bg-gray-800/70 active:scale-[0.995]'
                } ${isFocused ? 'ring-2 ring-indigo-500/50 border-indigo-500/30' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Type icon */}
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0 ${ti.color}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={ti.svg} />
                  </svg>
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${isUnread ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {highlightMatch ? highlightMatch(n.title) : n.title}
                    </p>
                    {isUnread && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 animate-pulse" />
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {highlightMatch ? highlightMatch(n.body) : n.body}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {relativeTime(n.createdAt)}
                    </span>
                    {projectName && (
                      <>
                        <span className="text-gray-700">&middot;</span>
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {projectName}
                        </span>
                      </>
                    )}
                    <span className="text-gray-700">&middot;</span>
                    <span className="text-xs text-gray-600">{ti.label}</span>
                  </div>
                </div>

                {/* Arrow for actionUrl */}
                {n.actionUrl && (
                  <span className="text-gray-600 text-sm shrink-0 mt-1 flex items-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
