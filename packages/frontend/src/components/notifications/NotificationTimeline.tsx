import type { Notification, NotificationType } from '@ai-jam/shared';

const typeIcons: Record<NotificationType, { color: string; svg: string }> = {
  agent_completed: { color: 'bg-green-500', svg: 'M5 13l4 4L19 7' },
  ticket_moved: { color: 'bg-blue-500', svg: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  gate_result: { color: 'bg-amber-500', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  comment_added: { color: 'bg-indigo-500', svg: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  proposal_created: { color: 'bg-purple-500', svg: 'M12 4v16m8-8H4' },
  proposal_resolved: { color: 'bg-teal-500', svg: 'M9 12l2 2 4-4' },
  scan_completed: { color: 'bg-yellow-500', svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
};

interface NotificationTimelineProps {
  notifications: Notification[];
  onNotificationClick: (n: Notification) => void;
  getProjectName: (projectId: string | null) => string | null;
}

export default function NotificationTimeline({
  notifications,
  onNotificationClick,
  getProjectName,
}: NotificationTimelineProps) {
  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500">No activity yet</p>
        <p className="text-xs text-gray-600 mt-1">Your activity timeline will appear here</p>
      </div>
    );
  }

  // Calculate activity statistics
  const activityByType = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalActivity = notifications.length;
  const mostActiveType = Object.entries(activityByType).sort(([, a], [, b]) => b - a)[0];
  const activityRate = totalActivity > 0 ? Math.round((notifications.filter(n => !n.isRead).length / totalActivity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Activity Summary */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Activity Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{totalActivity}</div>
            <div className="text-xs text-gray-500 mt-1">Total events</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-400">{activityRate}%</div>
            <div className="text-xs text-gray-500 mt-1">Engagement</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {mostActiveType ? mostActiveType[1] : 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Most active: {mostActiveType ? mostActiveType[0] : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800 animate-timeline-line" />

        {/* Timeline items */}
        <div className="space-y-0">
          {notifications.map((n, index) => {
            const ti = typeIcons[n.type] || { color: 'bg-gray-500', svg: 'M12 4v16m8-8H4' };
            const projectName = getProjectName(n.projectId);
            const isFirst = index === 0;
            const isLast = index === notifications.length - 1;

            return (
              <div
                key={n.id}
                className="relative pl-10 py-2 hover:bg-gray-800/30 rounded-r-lg transition-all duration-200 cursor-pointer"
                onClick={() => onNotificationClick(n)}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${ti.color} ${
                    !n.isRead ? 'animate-activity-pulse shadow-lg shadow-blue-500/30' : ''
                  }`}
                  style={{
                    boxShadow: !n.isRead ? `0 0 0 4px ${ti.color.replace('bg-', 'bg-').replace('500', '500/20')}` : undefined,
                  }}
                />

                {/* Content */}
                <div className={`transition-all duration-200 ${n.isRead ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center text-white ${ti.color}`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={ti.svg} />
                      </svg>
                    </span>
                    <p className={`text-sm truncate ${n.isRead ? 'text-gray-400' : 'text-white font-medium'}`}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                    )}
                  </div>

                  {n.body && (
                    <p className="text-xs text-gray-500 truncate ml-7">{n.body}</p>
                  )}

                  <div className="flex items-center gap-2 mt-1 ml-7">
                    <span className="text-xs text-gray-600">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {projectName && (
                      <>
                        <span className="text-gray-700">&middot;</span>
                        <span className="text-xs text-gray-600">{projectName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className="absolute left-4 top-4 bottom-0 w-px bg-gradient-to-b from-gray-800 to-transparent" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
