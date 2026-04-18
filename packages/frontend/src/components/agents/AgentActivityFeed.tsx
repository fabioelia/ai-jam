import { useAgentStore, type ActivityLogEntry } from '../../stores/agent-store.js';
import AgentSessionCard from './AgentSessionCard.js';

export default function AgentActivityFeed() {
  const sessions = useAgentStore((s) => s.sessions);
  const activityLog = useAgentStore((s) => s.activityLog);
  const clearCompleted = useAgentStore((s) => s.clearCompleted);

  const activeSessions = [...sessions.values()].filter(
    (s) => s.status === 'running' || s.status === 'starting'
  );
  const completedSessions = [...sessions.values()].filter(
    (s) => s.status === 'completed' || s.status === 'failed'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Active sessions */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-white">Active Agents</h3>
            {activeSessions.length > 0 && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full animate-pulse">
                {activeSessions.length}
              </span>
            )}
          </div>
          {completedSessions.length > 0 && (
            <button
              onClick={clearCompleted}
              className="text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800 px-2 py-1 rounded transition-colors hover:shadow-sm active:scale-95"
              title="Clear completed sessions"
            >
              Clear done
            </button>
          )}
        </div>

        {activeSessions.length === 0 && completedSessions.length === 0 ? (
          <div className="py-8 text-center animate-in fade-in duration-500">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2 animate-in scale-in duration-300">
              <svg className="w-5 h-5 text-gray-600 animate-in fade-in duration-500 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1m8.06-4a6.002 6.002 0 01-9.58-5.092M9 10a3.003 3.003 0 00-.72 2.063L9 10m6-6a3.003 3.003 0 00-5.918 3.422M14 6l-.5-4.285m0 8.569L9 10" />
              </svg>
            </div>
            <p className="text-xs text-gray-600 animate-in fade-in duration-300 delay-200">No agent activity</p>
            <p className="text-[10px] text-gray-700 mt-1 animate-in fade-in duration-300 delay-300">Start planning or pick up tickets to begin</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((session, index) => (
              <div key={session.sessionId} className="animate-in slide-in-from-bottom duration-200" style={{ animationDelay: `${index * 50}ms` }}>
                <AgentSessionCard session={session} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800/50">
          <h3 className="text-sm font-medium text-gray-400 flex items-center justify-between">
            <span>Activity Log</span>
            {activityLog.length > 0 && (
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
                {activityLog.length}
              </span>
            )}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {activityLog.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-gray-600 italic">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {activityLog.slice(0, 50).map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogEntry({ entry }: { entry: ActivityLogEntry }) {
  const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const typeConfig: Record<string, { color: string; icon: string; bg: string }> = {
    started: { color: 'text-blue-400', icon: '▶', bg: 'bg-blue-500/10' },
    activity: { color: 'text-gray-400', icon: '•', bg: 'bg-gray-500/10' },
    output: { color: 'text-gray-500', icon: '→', bg: 'bg-gray-500/10' },
    completed: { color: 'text-green-400', icon: '✓', bg: 'bg-green-500/10' },
  };

  const config = typeConfig[entry.type] || typeConfig.activity;

  return (
    <div className="flex items-start gap-2 text-xs py-1.5 hover:bg-gray-800/40 rounded px-1.5 transition-all duration-150 cursor-default">
      <span className="text-gray-600 shrink-0 font-mono text-[10px] w-16 text-right">{timeStr}</span>
      <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className={`text-[10px] uppercase tracking-wide ${config.color} block`}>
          {entry.personaType.replace(/_/g, ' ')}
        </span>
        <span className="text-gray-500 block truncate hover:text-gray-400 transition-colors">{entry.message}</span>
      </div>
    </div>
  );
}
