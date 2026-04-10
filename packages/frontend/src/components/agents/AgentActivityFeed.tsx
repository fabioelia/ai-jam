import { useAgentStore, type ActivityLogEntry } from '../../stores/agent-store.js';
import AgentSessionCard from './AgentSessionCard.js';

export default function AgentActivityFeed() {
  const sessions = useAgentStore((s) => s.sessions);
  const activityLog = useAgentStore((s) => s.activityLog);
  const clearCompleted = useAgentStore((s) => s.clearCompleted);

  const activeSessions = [...sessions.values()].filter(
    (s) => s.status === 'running' || s.status === 'starting'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Active sessions */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">
            Active Agents ({activeSessions.length})
          </h3>
          {sessions.size > activeSessions.length && (
            <button
              onClick={clearCompleted}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              Clear done
            </button>
          )}
        </div>

        {activeSessions.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No agents running</p>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <AgentSessionCard key={session.sessionId} session={session} />
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Activity Log</h3>
        {activityLog.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No activity yet</p>
        ) : (
          <div className="space-y-1">
            {activityLog.slice(0, 50).map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogEntry({ entry }: { entry: ActivityLogEntry }) {
  const timeStr = new Date(entry.timestamp).toLocaleTimeString();

  const typeColors: Record<string, string> = {
    started: 'text-blue-400',
    activity: 'text-gray-400',
    output: 'text-gray-500',
    completed: 'text-green-400',
  };

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-gray-600 shrink-0 w-16">{timeStr}</span>
      <span className={`shrink-0 ${typeColors[entry.type] || 'text-gray-400'}`}>
        {entry.personaType.replace(/_/g, ' ')}
      </span>
      <span className="text-gray-500 truncate">{entry.message}</span>
    </div>
  );
}
