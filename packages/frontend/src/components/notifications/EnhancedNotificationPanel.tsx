import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useNotifications } from '../../api/queries.js';
import { useMarkRead, useMarkAllRead } from '../../api/mutations.js';
import { useNotificationStore } from '../../stores/notification-store.js';
import { useProjects } from '../../api/queries.js';
import type { Notification, Project } from '@ai-jam/shared';
import { toast } from '../../stores/toast-store.js';
import NotificationFilters from './NotificationFilters.js';
import NotificationGroup from './NotificationGroup.js';
import NotificationTimeline from './NotificationTimeline.js';
import NotificationPreferences from './NotificationPreferences.js';

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
type TypeFilter = string;

interface EnhancedNotificationPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function EnhancedNotificationPanel({
  projectId,
  onClose,
}: EnhancedNotificationPanelProps) {
  const navigate = useNavigate();
  const { data: notifications } = useNotifications(projectId, { limit: 50 });
  const { data: projects } = useProjects();
  const markReadMutation = useMarkRead(projectId);
  const markAllReadMutation = useMarkAllRead(projectId);
  const storeMarkRead = useNotificationStore((s) => s.markRead);
  const storeMarkAllRead = useNotificationStore((s) => s.markAllRead);
  const panelRef = useRef<HTMLDivElement>(null);

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [projectFilter, setProjectFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [showPreferences, setShowPreferences] = useState(false);

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

  // Reset focus when filters change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery, readFilter, typeFilter, projectFilter]);

  // Filter and search notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications || [];

    // Apply read filter
    if (readFilter === 'unread') {
      result = result.filter((n) => !n.isRead);
    } else if (readFilter === 'read') {
      result = result.filter((n) => n.isRead);
    }

    // Apply type filter
    if (typeFilter) {
      result = result.filter((n) => n.type === typeFilter);
    }

    // Apply project filter
    if (projectFilter) {
      result = result.filter((n) => n.projectId === projectFilter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          (n.body && n.body.toLowerCase().includes(query))
      );
    }

    return result;
  }, [notifications, searchQuery, readFilter, typeFilter, projectFilter]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups = filteredNotifications.reduce((acc, n) => {
      const group = getDateGroup(n.createdAt);
      if (!acc[group]) acc[group] = [];
      acc[group].push(n);
      return acc;
    }, {} as Record<string, Notification[]>);

    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
    return groupOrder
      .map((groupName) => ({
        name: groupName,
        notifications: groups[groupName] || [],
      }))
      .filter((group) => group.notifications.length > 0);
  }, [filteredNotifications]);

  // Calculate global index for keyboard navigation
  const getGlobalIndex = (groupIndex: number, notificationIndex: number) => {
    let globalIndex = 0;
    for (let i = 0; i < groupIndex; i++) {
      globalIndex += groupedNotifications[i].notifications.length;
    }
    return globalIndex + notificationIndex;
  };

  // Highlight search matches
  const highlightMatch = (text: string) => {
    if (!searchQuery.trim()) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5 animate-search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

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
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('All notifications marked as read');
      },
    });
  }

  function handleClearFilters() {
    setSearchQuery('');
    setReadFilter('all');
    setTypeFilter('');
    setProjectFilter('');
  }

  function getProjectName(projectId: string | null) {
    if (!projectId || !projects) return null;
    return projects.find((p) => p.id === projectId)?.name ?? null;
  }

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;
  const hasActiveFilters = !!searchQuery || readFilter !== 'all' || !!typeFilter || !!projectFilter;

  return (
    <>
      <div
        ref={panelRef}
        className="absolute right-0 top-full mt-2 w-full sm:w-[420px] max-w-sm sm:max-w-none bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-right"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full animate-badge-bounce">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-all duration-200 ${
                  viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`p-1.5 rounded transition-all duration-200 ${
                  viewMode === 'timeline' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
                }`}
                title="Timeline view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            </div>

            {/* Preferences button */}
            <button
              onClick={() => setShowPreferences(true)}
              className="text-gray-400 hover:text-white transition-colors duration-200 p-1.5 rounded-lg hover:bg-gray-800"
              title="Notification preferences"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <NotificationFilters
          projects={projects || []}
          onSearchChange={setSearchQuery}
          onReadFilterChange={setReadFilter}
          onTypeFilterChange={setTypeFilter}
          onProjectFilterChange={setProjectFilter}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          searchQuery={searchQuery}
          readFilter={readFilter}
          typeFilter={typeFilter}
          projectFilter={projectFilter}
        />

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 animate-in scale-in duration-300">
                <svg
                  className="w-6 h-6 text-gray-600 animate-in fade-in duration-300 delay-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 animate-in fade-in duration-300 delay-200">No notifications yet</p>
              <p className="text-xs text-gray-600 mt-1 animate-in fade-in duration-300 delay-300">
                You'll see updates here
              </p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No notifications match your filters</p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors duration-200"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="p-4">
              <NotificationTimeline
                notifications={filteredNotifications}
                onNotificationClick={handleClick}
                getProjectName={getProjectName}
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {groupedNotifications.map((group, groupIndex) => (
                <NotificationGroup
                  key={group.name}
                  groupName={group.name}
                  notifications={group.notifications}
                  onNotificationClick={handleClick}
                  focusedIndex={focusedIndex}
                  globalIndexStart={groupedNotifications
                    .slice(0, groupIndex)
                    .reduce((sum, g) => sum + g.notifications.length, 0)}
                  getProjectName={getProjectName}
                  searchQuery={searchQuery}
                  highlightMatch={highlightMatch}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1 transition-all duration-200 px-2 py-1 rounded hover:bg-indigo-500/10 active:bg-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/10 active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Mark all read
            </button>
          )}
          <button
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 py-2 px-3 rounded-lg hover:bg-indigo-500/10 hover:shadow-sm active:bg-indigo-500/20 active:scale-95 transition-all duration-200"
          >
            View all notifications
          </button>
        </div>
      </div>

      {/* Preferences Modal */}
      <NotificationPreferences
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        projects={projects || []}
        preferences={[]}
        onSave={() => {
          toast.success('Notification preferences saved');
        }}
      />
    </>
  );
}
