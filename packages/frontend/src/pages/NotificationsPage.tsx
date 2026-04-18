import { useState, useEffect, useRef } from 'react';
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
import { getClientErrorMessage } from '../api/client.js';
import { toast } from '../stores/toast-store.js';

const PAGE_SIZE = 30;

const typeIcons: Record<string, { icon: string; color: string; label: string; svg: string }> = {
  agent_completed: { icon: '\u2713', color: 'text-green-400 bg-green-500/10', label: 'Agent completed', svg: 'M5 13l4 4L19 7' },
  ticket_moved: { icon: '\u2192', color: 'text-blue-400 bg-blue-500/10', label: 'Ticket moved', svg: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  gate_result: { icon: '\u2691', color: 'text-amber-400 bg-amber-500/10', label: 'Gate result', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  comment_added: { icon: '\uD83D\uDCAC', color: 'text-indigo-400 bg-indigo-500/10', label: 'Comment added', svg: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  proposal_created: { icon: '+', color: 'text-purple-400 bg-purple-500/10', label: 'Proposal created', svg: 'M12 4v16m8-8H4' },
  proposal_resolved: { icon: '\u2714', color: 'text-teal-400 bg-teal-500/10', label: 'Proposal resolved', svg: 'M9 12l2 2 4-4' },
  scan_completed: { icon: '\uD83D\uDD0D', color: 'text-yellow-400 bg-yellow-500/10', label: 'Scan completed', svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
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

function getDateGroup(date: string): string {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffDays = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Older';
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const notificationListRef = useRef<HTMLDivElement>(null);

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

  // Reset focus when displayed notifications change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [displayed.length, projectFilter, typeFilter, readFilter, offset]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetFilters();
        return;
      }

      if (displayed.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, displayed.length - 1));
        scrollNotificationIntoView(Math.min(focusedIndex + 1, displayed.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        scrollNotificationIntoView(Math.max(focusedIndex - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        handleClick(displayed[focusedIndex]);
      } else if (e.key === 'm' || e.key === 'M') {
        // 'm' key to mark all as read
        e.preventDefault();
        handleMarkAllRead();
      } else if ((e.key === 'd' || e.key === 'D') && readFilter !== 'unread') {
        // 'd' key to delete read notifications
        e.preventDefault();
        handleDeleteRead();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [displayed, focusedIndex, projectFilter, readFilter]);

  function scrollNotificationIntoView(index: number) {
    const buttons = notificationListRef.current?.querySelectorAll('button[role="listitem"]');
    const button = buttons?.[index] as HTMLElement;
    if (button) {
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

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
        toast.error(`Failed to mark notifications: ${getClientErrorMessage(error)}`);
      }
    });
  }

  function handleDeleteRead() {
    deleteReadMutation.mutate(projectFilter || undefined, {
      onSuccess: () => {
        toast.success('Read notifications deleted');
      },
      onError: (error) => {
        toast.error(`Failed to delete notifications: ${getClientErrorMessage(error)}`);
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
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
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
        {/* Stats header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">All Notifications</h2>
            <span className="text-sm text-gray-500">
              {displayed.filter(n => !n.isRead).length} unread of {displayed.length} total
            </span>
          </div>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-all duration-200 hover:bg-gray-800 px-2 py-1 rounded active:bg-gray-700"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>

        {/* Filters + bulk actions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Project filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="project-filter" className="text-xs text-gray-500">Project:</label>
              <select
                id="project-filter"
                value={projectFilter}
                onChange={(e) => { setProjectFilter(e.target.value); setOffset(0); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
              >
                <option value="">All projects</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="type-filter" className="text-xs text-gray-500">Type:</label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
              >
                <option value="">All types</option>
                {notificationTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Read/unread filter */}
            <div className="flex items-center gap-2">
              <label htmlFor="read-filter" className="text-xs text-gray-500">Status:</label>
              <select
                id="read-filter"
                value={readFilter}
                onChange={(e) => { setReadFilter(e.target.value as ReadFilter); setOffset(0); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>

            <div className="flex-1" />

            {/* Bulk actions */}
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1 transition-all duration-200 px-2 py-1 rounded hover:bg-indigo-500/10 active:bg-indigo-500/20 active:scale-95"
              title="Mark all notifications as read (M)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Mark all read
            </button>
            {readFilter !== 'unread' && (
              <button
                onClick={handleDeleteRead}
                disabled={deleteReadMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 flex items-center gap-1 transition-all duration-200 px-2 py-1 rounded hover:bg-red-500/10 active:bg-red-500/20 active:scale-95"
                title="Delete all read notifications (D)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete read
              </button>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-600 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">Enter</kbd>
              <span>Open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">M</kbd>
              <span>Mark all read</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">D</kbd>
              <span>Delete read</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">Esc</kbd>
              <span>Clear filters</span>
            </span>
          </div>
        </div>

        {/* Notification list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-gray-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-800/50 rounded w-1/2 animate-pulse" />
                  <div className="h-3 bg-gray-800/30 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              {hasFilters ? 'No notifications match your filters' : 'No notifications yet'}
            </h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              {hasFilters ? 'Try adjusting your filters to see more results.' : 'You\'ll see updates here when there\'s activity in your projects.'}
            </p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div ref={notificationListRef} className="space-y-6" role="list" aria-label="Notifications">
            {(() => {
              // Group notifications by date
              const groups = displayed.reduce((acc, n) => {
                const group = getDateGroup(n.createdAt);
                if (!acc[group]) acc[group] = [];
                acc[group].push(n);
                return acc;
              }, {} as Record<string, Notification[]>);

              const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];

              return groupOrder.map((groupName) => {
                const groupNotifications = groups[groupName];
                if (!groupNotifications || groupNotifications.length === 0) return null;

                return (
                  <div key={groupName} className="animate-in slide-in-from-bottom duration-300">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                      {groupName} ({groupNotifications.length})
                    </h3>
                    <div className="space-y-1">
                      {groupNotifications.map((n) => {
                        const ti = typeIcons[n.type] || {
                          icon: '\u2022',
                          color: 'text-gray-400 bg-gray-500/10',
                          label: n.type,
                          svg: 'M12 4v16m8-8H4'
                        };
                        const projectName = getProjectName(n.projectId);
                        const globalIndex = displayed.indexOf(n);
                        const isFocused = focusedIndex === globalIndex;

                        return (
                          <button
                            key={n.id}
                            onClick={() => handleClick(n)}
                            role="listitem"
                            className={`w-full text-left px-4 py-3 flex gap-3 items-start rounded-xl border transition-all duration-200 ${
                              n.isRead
                                ? 'bg-gray-900/30 border-gray-800/50 hover:bg-gray-800/50 hover:border-gray-700/50 hover:shadow-md hover:shadow-gray-900/10 hover:-translate-y-0.5'
                                : 'bg-gray-900/80 border-gray-700 hover:bg-gray-800/80 hover:border-gray-600 hover:shadow-md hover:shadow-gray-900/10 hover:-translate-y-0.5'
                            } ${isFocused ? 'ring-2 ring-indigo-500/50 border-indigo-500/30' : ''}`}
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
                                <p className={`text-sm truncate ${n.isRead ? 'text-gray-400' : 'text-white font-medium'}`}>
                                  {n.title}
                                </p>
                                {!n.isRead && (
                                  <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 animate-pulse" />
                                )}
                              </div>
                              {n.body && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
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
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (displayed.length > 0 || offset > 0) && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-800">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Newer
            </button>
            <span className="text-xs text-gray-600">
              Showing {offset + 1}–{offset + displayed.length}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={!hasMore}
              className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              Older
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
