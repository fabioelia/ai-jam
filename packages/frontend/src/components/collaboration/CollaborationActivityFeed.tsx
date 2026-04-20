import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Comment, TicketNote, TransitionGate, User } from '@ai-jam/shared';
import { formatDistanceToNow } from 'date-fns';

interface CollaborationActivity {
  id: string;
  type: 'comment' | 'note' | 'gate' | 'assignment' | 'status_change' | 'handoff';
  timestamp: number;
  userId?: string;
  userName?: string;
  userAvatar?: string | null;
  ticketId?: string;
  ticketTitle?: string;
  description: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

interface CollaborationActivityFeedProps {
  comments?: Comment[];
  notes?: TicketNote[];
  gates?: TransitionGate[];
  users?: User[];
  currentUserId: string;
  maxItems?: number;
  showFilters?: boolean;
  onActivityClick?: (activity: CollaborationActivity) => void;
}

type ActivityFilter = 'all' | 'comments' | 'notes' | 'gates' | 'assignments';
type TimeFilter = 'all' | 'today' | 'week' | 'month';

export default function CollaborationActivityFeed({
  comments = [],
  notes = [],
  gates = [],
  users = [],
  currentUserId,
  maxItems = 20,
  showFilters = true,
  onActivityClick,
}: CollaborationActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Build unified activity feed
  const allActivities = useMemo((): CollaborationActivity[] => {
    const activities: CollaborationActivity[] = [];

    // Add comments
    comments.forEach((comment) => {
      const user = users.find((u) => u.id === comment.userId);
      activities.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        timestamp: new Date(comment.createdAt).getTime(),
        userId: comment.userId,
        userName: user?.name,
        userAvatar: user?.avatarUrl,
        ticketId: comment.ticketId,
        description: 'added a comment',
        details: comment.body.substring(0, 100) + (comment.body.length > 100 ? '...' : ''),
        metadata: { commentId: comment.id },
      });
    });

    // Add notes (handoffs)
    notes.forEach((note) => {
      const isHandoff = note.handoffFrom || note.handoffTo;
      const userName = note.authorType === 'user' ? note.authorId : note.authorType;

      activities.push({
        id: `note-${note.id}`,
        type: isHandoff ? 'handoff' : 'note',
        timestamp: new Date(note.createdAt).getTime(),
        userId: note.authorType === 'user' ? note.authorId : undefined,
        userName,
        ticketId: note.ticketId,
        description: isHandoff
          ? `handed off from ${note.handoffFrom} to ${note.handoffTo}`
          : 'added a note',
        details: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
        metadata: { noteId: note.id, handoffFrom: note.handoffFrom, handoffTo: note.handoffTo },
      });
    });

    // Add gates
    gates.forEach((gate) => {
      activities.push({
        id: `gate-${gate.id}`,
        type: 'gate',
        timestamp: new Date(gate.createdAt).getTime(),
        ticketId: gate.ticketId,
        description: `gate: ${gate.fromStatus} → ${gate.toStatus}`,
        details: gate.result,
        metadata: { gateId: gate.id, gatekeeper: gate.gatekeeperPersona },
      });
    });

    // Sort by timestamp (newest first)
    return activities.sort((a, b) => b.timestamp - a.timestamp);
  }, [comments, notes, gates, users]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = [...allActivities];

    // Apply type filter
    if (filter !== 'all') {
      filtered = filtered.filter((a) => {
        if (filter === 'comments') return a.type === 'comment';
        if (filter === 'notes') return a.type === 'note' || a.type === 'handoff';
        if (filter === 'gates') return a.type === 'gate';
        if (filter === 'assignments') return a.type === 'assignment';
        return true;
      });
    }

    // Apply time filter
    const now = Date.now();
    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((a) => a.timestamp >= today.getTime());
    } else if (timeFilter === 'week') {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((a) => a.timestamp >= weekAgo);
    } else if (timeFilter === 'month') {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((a) => a.timestamp >= monthAgo);
    }

    // Limit items
    return filtered.slice(0, maxItems);
  }, [allActivities, filter, timeFilter, maxItems]);

  // Group activities by time
  const groupedActivities = useMemo(() => {
    const groups: Record<string, CollaborationActivity[]> = {};
    const now = Date.now();
    const today = new Date(now).setHours(0, 0, 0, 0);
    const yesterday = today - 24 * 60 * 60 * 1000;
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = today - 30 * 24 * 60 * 60 * 1000;

    filteredActivities.forEach((activity) => {
      let groupKey: string;

      if (activity.timestamp >= today) {
        groupKey = 'Today';
      } else if (activity.timestamp >= yesterday) {
        groupKey = 'Yesterday';
      } else if (activity.timestamp >= weekAgo) {
        groupKey = 'This Week';
      } else if (activity.timestamp >= monthAgo) {
        groupKey = 'This Month';
      } else {
        const date = new Date(activity.timestamp);
        groupKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(activity);
    });

    return groups;
  }, [filteredActivities]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getActivityIcon = useCallback((activity: CollaborationActivity) => {
    switch (activity.type) {
      case 'comment':
        return (
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case 'note':
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2h2.828l-8.586-8.586z" />
            </svg>
          </div>
        );
      case 'handoff':
        return (
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        );
      case 'gate':
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        );
      case 'assignment':
        return (
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
      case 'status_change':
        return (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  }, []);

  const getActivityColor = useCallback((activity: CollaborationActivity) => {
    switch (activity.type) {
      case 'comment':
        return 'text-indigo-400';
      case 'note':
        return 'text-blue-400';
      case 'handoff':
        return 'text-purple-400';
      case 'gate':
        return 'text-amber-400';
      case 'assignment':
        return 'text-green-400';
      case 'status_change':
        return 'text-cyan-400';
      default:
        return 'text-gray-400';
    }
  }, []);

  const formatRelativeTime = useCallback((timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'just now';
    }
  }, []);

  if (allActivities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-3">
          <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No collaboration activity yet</p>
        <p className="text-gray-600 text-xs mt-1">Activity will appear here as your team collaborates</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Collaboration Activity
          </h3>
          <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
            {allActivities.length}
          </span>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2 mt-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ActivityFilter)}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
            >
              <option value="all">All Activity</option>
              <option value="comments">Comments</option>
              <option value="notes">Notes & Handoffs</option>
              <option value="gates">Gates</option>
              <option value="assignments">Assignments</option>
            </select>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        )}
      </div>

      {/* Activity List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="divide-y divide-gray-800">
          {Object.entries(groupedActivities).map(([groupKey, activities]) => (
            <div key={groupKey}>
              {/* Group Header */}
              <div className="px-4 py-2 bg-gray-900/30 sticky top-0 z-10">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{groupKey}</h4>
              </div>

              {/* Activities */}
              <div className="space-y-0.5">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => onActivityClick?.(activity)}
                    className={`
                      px-4 py-3 hover:bg-gray-800/30 transition-colors cursor-pointer
                      ${expanded.has(activity.id) ? 'bg-gray-800/40' : ''}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        {getActivityIcon(activity)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {activity.userAvatar ? (
                            <img
                              src={activity.userAvatar}
                              alt={activity.userName || 'User'}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-medium text-white">
                              {activity.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-200">
                            {activity.userName || activity.userId?.slice(0, 8) || 'Agent'}
                          </span>
                          <span className={`text-xs ${getActivityColor(activity)}`}>
                            {activity.description}
                          </span>
                        </div>

                        {/* Details */}
                        {activity.details && (
                          <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {activity.details}
                          </div>
                        )}

                        {/* Timestamp */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-gray-600">
                            {formatRelativeTime(activity.timestamp)}
                          </span>
                          {activity.metadata?.ticketId && (
                            <span className="text-[10px] text-gray-600 font-mono">
                              #{activity.metadata.ticketId.slice(0, 6)}
                            </span>
                          )}
                        </div>

                        {/* Expand button */}
                        {activity.details && activity.details.length > 50 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(activity.id);
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 flex items-center gap-1"
                          >
                            <span>{expanded.has(activity.id) ? 'Show less' : 'Show more'}</span>
                            <svg
                              className={`w-3 h-3 transition-transform ${expanded.has(activity.id) ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer with stats */}
      <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/30">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {filteredActivities.length} of {allActivities.length} activities
          </span>
          <span className="text-gray-600">
            Showing {filter !== 'all' ? filter : 'all types'}
          </span>
        </div>
      </div>
    </div>
  );
}
