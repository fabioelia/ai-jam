import { useState, useMemo, useCallback } from 'react';
import type { User, ProjectMember, Ticket, Comment, TicketNote, TransitionGate } from '@ai-jam/shared';
import { formatDistanceToNow } from 'date-fns';

interface TeamActivityOverviewProps {
  projectId: string;
  users?: User[];
  projectMembers?: ProjectMember[];
  tickets?: Ticket[];
  comments?: Comment[];
  notes?: TicketNote[];
  gates?: TransitionGate[];
  currentUserId: string;
}

interface UserActivity {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  role: string;
  activities: number;
  comments: number;
  ticketsAssigned: number;
  ticketsCreated: number;
  lastActive: number;
  isActive: boolean;
}

interface ActivityData {
  totalActivities: number;
  totalComments: number;
  totalTickets: number;
  totalHandoffs: number;
  totalGates: number;
  activeUsers: number;
  completionRate: number;
  avgResponseTime: number;
}

export default function TeamActivityOverview({
  projectId,
  users = [],
  projectMembers = [],
  tickets = [],
  comments = [],
  notes = [],
  gates = [],
  currentUserId,
}: TeamActivityOverviewProps) {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [sortBy, setSortBy] = useState<'activity' | 'comments' | 'tickets' | 'recent'>('activity');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');

  // Get user activity data
  const userActivities = useMemo((): UserActivity[] => {
    const memberUsers = projectMembers.map((member) => {
      const user = users.find((u) => u.id === member.userId);
      return { user, member };
    }).filter((item) => item.user !== undefined);

    return memberUsers.map(({ user, member }) => {
      const userId = user!.id;

      // Filter by time range
      const now = Date.now();
      let timeFilter = (_date: Date) => true;

      if (timeRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        timeFilter = (date) => date.getTime() >= today.getTime();
      } else if (timeRange === 'week') {
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        timeFilter = (date) => date.getTime() >= weekAgo;
      } else if (timeRange === 'month') {
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
        timeFilter = (date) => date.getTime() >= monthAgo;
      }

      // Count activities
      const userComments = comments.filter((c) => c.userId === userId && timeFilter(new Date(c.createdAt)));
      const userTicketsAssigned = tickets.filter((t) => t.assignedUserId === userId && timeFilter(new Date(t.createdAt)));
      const userTicketsCreated = tickets.filter((t) => t.createdBy === userId && timeFilter(new Date(t.createdAt)));
      const userNotes = notes.filter((n) => n.authorId === userId && timeFilter(new Date(n.createdAt)));

      // Calculate last activity
      const allActivities = [
        ...userComments.map((c) => new Date(c.createdAt).getTime()),
        ...userTicketsAssigned.map((t) => new Date(t.createdAt).getTime()),
        ...userTicketsCreated.map((t) => new Date(t.createdAt).getTime()),
        ...userNotes.map((n) => new Date(n.createdAt).getTime()),
      ];

      const lastActivity = allActivities.length > 0 ? Math.max(...allActivities) : 0;

      return {
        userId,
        userName: user!.name,
        avatarUrl: user!.avatarUrl,
        role: member.role,
        activities: userComments.length + userTicketsAssigned.length + userTicketsCreated.length + userNotes.length,
        comments: userComments.length,
        ticketsAssigned: userTicketsAssigned.length,
        ticketsCreated: userTicketsCreated.length,
        lastActive: lastActivity,
        isActive: lastActivity > 0 && now - lastActivity < 15 * 60 * 1000, // Active within 15 minutes
      };
    });
  }, [users, projectMembers, tickets, comments, notes, timeRange]);

  // Sort user activities
  const sortedUserActivities = useMemo(() => {
    return [...userActivities].sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          return b.activities - a.activities;
        case 'comments':
          return b.comments - a.comments;
        case 'tickets':
          return b.ticketsAssigned + b.ticketsCreated - (a.ticketsAssigned + a.ticketsCreated);
        case 'recent':
          return b.lastActive - a.lastActive;
        default:
          return 0;
      }
    });
  }, [userActivities, sortBy]);

  // Calculate overall activity data
  const activityData = useMemo((): ActivityData => {
    const now = Date.now();
    let timeFilter = (_date: Date) => true;

    if (timeRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      timeFilter = (date) => date.getTime() >= today.getTime();
    } else if (timeRange === 'week') {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      timeFilter = (date) => date.getTime() >= weekAgo;
    } else if (timeRange === 'month') {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      timeFilter = (date) => date.getTime() >= monthAgo;
    }

    const filteredComments = comments.filter((c) => timeFilter(new Date(c.createdAt)));
    const filteredTickets = tickets.filter((t) => timeFilter(new Date(t.createdAt)));
    const filteredNotes = notes.filter((n) => timeFilter(new Date(n.createdAt)));
    const filteredGates = gates.filter((g) => timeFilter(new Date(g.createdAt)));

    const activeUsers = userActivities.filter((u) => u.isActive).length;
    const approvedGates = filteredGates.filter((g) => g.result === 'approved').length;
    const completedTickets = filteredTickets.filter((t) => t.status === 'done').length;

    return {
      totalActivities: filteredComments.length + filteredTickets.length + filteredNotes.length + filteredGates.length,
      totalComments: filteredComments.length,
      totalTickets: filteredTickets.length,
      totalHandoffs: filteredNotes.filter((n) => n.handoffFrom || n.handoffTo).length,
      totalGates: filteredGates.length,
      activeUsers,
      completionRate: completedTickets > 0 ? (approvedGates / completedTickets) * 100 : 0,
      avgResponseTime: 0, // Would need actual response time data
    };
  }, [comments, tickets, notes, gates, userActivities, timeRange]);

  const formatRelativeTime = useCallback((timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'never';
    }
  }, []);

  const getActivityColor = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return 'text-green-400 bg-green-500/20';
      case 'medium':
        return 'text-amber-400 bg-amber-500/20';
      case 'low':
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getActivityLevel = (activities: number): 'high' | 'medium' | 'low' => {
    if (activities >= 10) return 'high';
    if (activities >= 5) return 'medium';
    return 'low';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Team Activity</h3>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-sm bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="activity">Most Active</option>
            <option value="comments">Most Comments</option>
            <option value="tickets">Most Tickets</option>
            <option value="recent">Most Recent</option>
          </select>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {(['list', 'grid', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded transition-colors ${viewMode === mode ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                title={mode.charAt(0).toUpperCase() + mode.slice(1) + ' view'}
              >
                {mode === 'list' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : mode === 'grid' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-800/30 rounded-lg p-4">
          <p className="text-2xl font-bold text-white">{activityData.totalActivities}</p>
          <p className="text-xs text-gray-500 mt-1">Total Activities</p>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-4">
          <p className="text-2xl font-bold text-indigo-400">{activityData.activeUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Active Users</p>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-4">
          <p className="text-2xl font-bold text-green-400">{activityData.completionRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Completion Rate</p>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-4">
          <p className="text-2xl font-bold text-purple-400">{activityData.totalHandoffs}</p>
          <p className="text-xs text-gray-500 mt-1">Handoffs</p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/20 rounded-lg p-3 text-center">
          <p className="text-sm font-semibold text-white">{activityData.totalComments}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Comments</p>
        </div>
        <div className="bg-gray-800/20 rounded-lg p-3 text-center">
          <p className="text-sm font-semibold text-white">{activityData.totalTickets}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Tickets</p>
        </div>
        <div className="bg-gray-800/20 rounded-lg p-3 text-center">
          <p className="text-sm font-semibold text-white">{activityData.totalGates}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Gates</p>
        </div>
        <div className="bg-gray-800/20 rounded-lg p-3 text-center">
          <p className="text-sm font-semibold text-white">{userActivities.length}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Team Members</p>
        </div>
      </div>

      {/* User Activities */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Team Members</h4>
        {viewMode === 'list' ? (
          <div className="space-y-2">
            {sortedUserActivities.map((user) => (
              <div
                key={user.userId}
                className="bg-gray-800/30 rounded-lg p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-medium text-white">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.userName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        user.userName.charAt(0).toUpperCase()
                      )}
                    </div>
                    {user.isActive && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-gray-900 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{user.userName}</p>
                      {user.userId === currentUserId && (
                        <span className="text-xs text-indigo-400">You</span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] ${getActivityColor(getActivityLevel(user.activities))}`}>
                        {getActivityLevel(getActivityLevel(user.activities)).charAt(0).toUpperCase() + getActivityLevel(user.activities).slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="font-semibold text-white">{user.activities}</p>
                      <p className="text-gray-600">Activities</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-white">{user.comments}</p>
                      <p className="text-gray-600">Comments</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-white">{user.ticketsAssigned + user.ticketsCreated}</p>
                      <p className="text-gray-600">Tickets</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-600">
                      {user.lastActive ? formatRelativeTime(user.lastActive) : 'Never'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sortedUserActivities.map((user) => (
              <div key={user.userId} className="bg-gray-800/30 rounded-lg p-4 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-medium text-white">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.userName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        user.userName.charAt(0).toUpperCase()
                      )}
                    </div>
                    {user.isActive && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-gray-900 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.userName}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">{user.activities}</p>
                    <p className="text-[10px] text-gray-600">Activities</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{user.comments}</p>
                    <p className="text-[10px] text-gray-600">Comments</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{user.ticketsAssigned + user.ticketsCreated}</p>
                    <p className="text-[10px] text-gray-600">Tickets</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {sortedUserActivities.map((user) => (
              <div
                key={user.userId}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800/30 rounded transition-colors"
              >
                <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-medium text-white">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.userName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.userName.charAt(0).toUpperCase()
                  )}
                </div>
                {user.isActive && (
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                )}
                <p className="text-xs font-medium text-white flex-1">{user.userName}</p>
                <p className="text-xs text-gray-500">{user.activities}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>Online</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded ${getActivityColor('high')}`}>High</span>
          <span>High Activity</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded ${getActivityColor('medium')}`}>Med</span>
          <span>Medium Activity</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded ${getActivityColor('low')}`}>Low</span>
          <span>Low Activity</span>
        </div>
      </div>
    </div>
  );
}
