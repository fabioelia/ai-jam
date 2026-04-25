import type { AgentFailurePatternMetrics, FailurePatternReport } from '../../api/mutations.js';

interface AgentFailurePatternModalProps {
  result: FailurePatternReport | null;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentFailurePatternMetrics['healthTier']): string {
  switch (tier) {
    case 'high': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-red-500/20 text-red-300 border-red-500/40';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
  }
}

function tierLabel(tier: AgentFailurePatternMetrics['healthTier']): string {
  switch (tier) {
    case 'high': return 'Healthy';
    case 'moderate': return 'Degraded';
    case 'low': return 'Failing';
    default: return 'Insufficient Data';
  }
}

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) {
    const diffM = Math.floor(diffMs / 60000);
    return diffM < 1 ? 'just now' : `${diffM}m ago`;
  }
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function AgentFailurePatternModal({
  result,
  loading,
  onClose,
}: AgentFailurePatternModalProps) {
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
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Agent Failure Patterns
            {result && (
              <span className="text-sm font-normal text-emerald-400/80 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {result.summary.totalFailedSessions} failures
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
                <span className="text-sm">Analyzing failure patterns...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No failure pattern data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-4 py-3">
                  <p className="text-emerald-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-emerald-200 text-xl font-bold">{result.summary.totalAgents}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Critical/Failing</p>
                  <p className="text-red-200 text-xl font-bold">{result.summary.criticalCount}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Healthy</p>
                  <p className="text-green-200 text-xl font-bold">{result.summary.healthyCount}</p>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-4 py-3">
                  <p className="text-emerald-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Failure Rate</p>
                  <p className="text-emerald-200 text-xl font-bold">{(result.summary.avgFailureRate * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-center">Total Sessions</th>
                      <th className="px-4 py-3 text-center">Failed</th>
                      <th className="px-4 py-3 text-center">Timed Out</th>
                      <th className="px-4 py-3 text-center">Failure Rate</th>
                      <th className="px-4 py-3 text-center">Max Streak</th>
                      <th className="px-4 py-3 text-center">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">
                          <div>{agent.agentName}</div>
                          <div className="text-xs text-gray-500">{formatRelativeTime(agent.lastFailedAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{agent.agentRole}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalSessions}</td>
                        <td className="px-4 py-3 text-center text-red-300">{agent.failedSessions}</td>
                        <td className="px-4 py-3 text-center text-orange-300">{agent.timedOutSessions}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-emerald-500"
                                style={{ width: `${Math.min(100, agent.healthScore)}%` }}
                              />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{(agent.failureRate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono text-xs ${agent.maxConsecutiveFailures >= 3 ? 'text-red-300' : agent.maxConsecutiveFailures >= 1 ? 'text-yellow-300' : 'text-gray-400'}`}>
                            {agent.maxConsecutiveFailures}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tierBadgeClass(agent.healthTier)}`}>
                            {tierLabel(agent.healthTier)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gradient-to-r from-emerald-900/20 to-emerald-800/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-emerald-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-emerald-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                {result.aiRecommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-emerald-100/70 text-sm flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
