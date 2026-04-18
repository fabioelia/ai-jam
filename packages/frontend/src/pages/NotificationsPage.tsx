import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllNotifications, useProjects } from '../api/queries.js';
import type { GlobalNotificationFilters } from '../api/queries.js';
import {
  useGlobalMarkRead,
  useGlobalMarkAllRead,
  useDeleteReadNotifications,
} from '../api/mutations.js';
import { useNotificationStore } from '../stores/notification-store.js';
import { useAuthStore } from '../stores/auth-store.js';
import { NotificationType } from '@ai-jam/shared';
import type { Notification } from '@ai-jam/shared';
import { toast } from '../stores/toast-store.js';

const PAGE_SIZE = 30;

const typeIcons: Record<string, { icon: string; color: string; label: string }> = {
  agent_completed: { icon: '\u2713', color: 'text-green-400 bg-green-500/10', label: 'Agent completed' },
  ticket_moved: { icon: '\u2192', color: 'text-blue-400 bg-blue-500/10', label: 'Ticket moved' },
  gate_result: { icon: '\u2691', color: 'text-amber-400 bg-amber-500/10', label: 'Gate result' },
  comment_added: { icon: '\uD83D\uDCAC', color: 'text-indigo-400 bg-indigo-500/10', label: 'Comment added' },
  proposal_created: { icon: '+', color: 'text-purple-400 bg-purple-500/10', label: 'Proposal created' },
  proposal_resolved: { icon: '\u2714', color: 'text-teal-400 bg-teal-500/10', label: 'Proposal resolved' },
  scan_completed: { icon: '\uD83D\uDD0D', color: 'text-yellow-400 bg-yellow-500/10', label: 'Scan completed' },
};

const notificationTypes = Object.entries(NotificationType).map(([, value]) => ({
  value,
  label: typeIcons[value]?.label ?? value,
}));

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

type ReadFilter = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const storeMarkRead = useNotificationStore((s) => s.markRead);
  const storeMarkAllRead = useNotificationStore((s) => s.markAllRead);

  const [projectFilter, setProjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [offset, setOffset] = useState(0);

  const filters: GlobalNotificationFilters = {
    limit: PAGE_SIZE,
    offset,
  };
  if (projectFilter) filters.projectId = projectFilter;
  if (typeFilter) filters.type = typeFilter;
  if (readFilter === 'unread') filters.unreadOnly = true;

  const { data: notifications, isLoading } = useAllNotifications(filters);
  const { data: projects } = useProjects();

  const markReadMutation = useGlobalMarkRead();
  const markAllReadMutation = useGlobalMarkAllRead();
  const deleteReadMutation = useDeleteReadNotifications();

  // Client-side filter for "read" since backend only has unreadOnly
  const displayed = readFilter === 'read'
    ? (notifications ?? []).filter((n) => n.isRead === 1)
    : (notifications ?? []);

  function handleClick(n: Notification) {
    if (!n.isRead) {
      storeMarkRead(n.id);
      markReadMutation.mutate(n.id);
    }
    if (n.actionUrl) {
      navigate(n.actionUrl);
    }
  }

  function handleMarkAllRead() {
    storeMarkAllRead(projectFilter || undefined);
    markAllReadMutation.mutate(projectFilter || undefined, {
      onSuccess: () => {
        toast.success('All notifications marked as read');
      },
      onError: (error) => {
        toast.error(`Failed to mark notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  function handleDeleteRead() {
    deleteReadMutation.mutate(projectFilter || undefined, {
      onSuccess: () => {
        toast.success('Read notifications deleted');
      },
      onError: (error) => {
        toast.error(`Failed to delete notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  function resetFilters() {
    setProjectFilter('');
    setTypeFilter('');
    setReadFilter('all');
    setOffset(0);
  }

  function getProjectName(projectId: string | null) {
    if (!projectId || !projects) return null;
    return projects.find((p) => p.id === projectId)?.name ?? null;
  }

  const hasFilters = !!projectFilter || !!typeFilter || readFilter !== 'all';
  const hasMore = (notifications?.length ?? 0) >= PAGE_SIZE;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white text-sm"
            >
              &larr; Dashboard
            </button>
            <h1 className="text-xl font-bold text-white">Notifications</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-gray-300 text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Filters + bulk actions */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); setOffset(0); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All projects</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All types</option>
            {notificationTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Read/unread filter */}
          <select
            value={readFilter}
            onChange={(e) => { setReadFilter(e.target.value as ReadFilter); setOffset(0); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Clear filters
            </button>
          )}

          <div className="flex-1" />

          {/* Bulk actions */}
          <button
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
          >
            Mark all read
          </button>
          <button
            onClick={handleDeleteRead}
            disabled={deleteReadMutation.isPending}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Delete read
          </button>
        </div>

        {/* Notification list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-lg h-16 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">
              {hasFilters ? 'No notifications match filters' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayed.map((n) => {
              const ti = typeIcons[n.type] || { icon: '\u2022', color: 'text-gray-400 bg-gray-500/10', label: n.type };
              const projectName = getProjectName(n.projectId);

              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start rounded-lg hover:bg-gray-800/50 transition-colors ${
                    n.isRead ? 'opacity-60' : 'bg-gray-900/50'
                  }`}
                >
                  {/* Type icon */}
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${ti.color}`}>
                    {ti.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${n.isRead ? 'text-gray-400' : 'text-white font-medium'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-600">{relativeTime(n.createdAt)}</span>
                      {projectName && (
                        <>
                          <span className="text-gray-700">&middot;</span>
                          <span className="text-xs text-gray-600">{projectName}</span>
                        </>
                      )}
                      <span className="text-gray-700">&middot;</span>
                      <span className="text-xs text-gray-600">{ti.label}</span>
                    </div>
                  </div>

                  {/* Arrow for actionUrl */}
                  {n.actionUrl && (
                    <span className="text-gray-600 text-sm shrink-0 mt-1">&rsaquo;</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (displayed.length > 0 || offset > 0) && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &larr; Newer
            </button>
            <span className="text-xs text-gray-600">
              {offset + 1}&ndash;{offset + displayed.length}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasMore}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Older &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
