import type { IdleTimeTrackerReport } from '../../api/mutations.js';

interface Props {
  result: IdleTimeTrackerReport | null;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'optimally_utilized': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'moderately_idle': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'highly_idle': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'critically_idle': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'optimally_utilized': return 'Optimally Utilized';
    case 'moderately_idle': return 'Moderately Idle';
    case 'highly_idle': return 'Highly Idle';
    case 'critically_idle': return 'Critically Idle';
    default: return 'Insufficient Data';
  }
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatIdleRatio(ratio: number): string {
  return (ratio * 100).toFixed(1) + '%';
}

export default function AgentIdleTimeTrackerModal({ result, loading, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Agent Idle Time Tracker
            {result && (
              <span className="text-sm font-normal text-green-400/80 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-full">
                {result.summary.totalAgents} agents
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing idle time patterns...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No idle time data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-green-200 text-xl font-bold">{result.summary.totalAgents}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Optimally Utilized</p>
                  <p className="text-green-200 text-xl font-bold">{result.summary.lowIdleCount}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Highly Idle</p>
                  <p className="text-red-200 text-xl font-bold">{result.summary.highIdleCount}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Idle Ratio</p>
                  <p className="text-green-200 text-xl font-bold">
                    {result.summary.totalAgents > 0
                      ? formatIdleRatio(result.agents.reduce((s, a) => s + a.idleTimeRatio, 0) / result.summary.totalAgents)
                      : '0.0%'}
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-700/50">
                  <h3 className="text-gray-300 text-sm font-medium">Agent Idle Time Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Agent</th>
                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Role</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Active Time</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Idle Time</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Total Tracked</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Idle Ratio</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Score</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.agents.map((agent) => (
                        <tr key={agent.agentId} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-white font-medium">{agent.agentName}</td>
                          <td className="px-4 py-2 text-gray-400">{agent.agentRole}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{formatDurationMs(agent.totalActiveTimeMs)}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{formatDurationMs(agent.totalIdleTimeMs)}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{formatDurationMs(agent.totalTrackedTimeMs)}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{formatIdleRatio(agent.idleTimeRatio)}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="bg-green-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(100, agent.idleScore)}%` }}
                                />
                              </div>
                              <span className="text-green-300 font-medium w-10 text-right">{agent.idleScore}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tierBadgeClass(agent.idleTier)}`}>
                              {tierLabel(agent.idleTier)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.aiSummary && (
                <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-700/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-green-300 font-medium text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </h3>
                  <p className="text-gray-300 text-sm">{result.aiSummary}</p>
                  {result.aiRecommendations && result.aiRecommendations.length > 0 && (
                    <ul className="space-y-1">
                      {result.aiRecommendations.map((rec, i) => (
                        <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
