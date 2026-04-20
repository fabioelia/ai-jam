import type { AgentProactivityReport, AgentProactivityMetrics } from '../../api/mutations.js';

interface Props {
  data: AgentProactivityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_BADGE: Record<AgentProactivityMetrics['proactivityTier'], string> = {
  proactive: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  engaged: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  reactive: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  passive: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function AgentProactivityModal({ data, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Agent Proactivity Analyzer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {/* Empty */}
          {!loading && !data && (
            <p className="text-gray-400 text-center py-12">No data available.</p>
          )}

          {!loading && data && (
            <>
              {/* Summary cards — 4 cards with amber theme */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{data.summary.totalAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Agents</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400">{data.summary.avgProactivityScore}</div>
                  <div className="text-xs text-gray-400 mt-1">Avg Proactivity Score</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-lg font-bold text-amber-300 truncate">{data.summary.mostProactive ?? '—'}</div>
                  <div className="text-xs text-gray-400 mt-1">Most Proactive</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{data.summary.proactiveAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Proactive Agents</div>
                </div>
              </div>

              {/* Agent table */}
              {data.agents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-800">
                        <th className="text-left pb-3 pr-4">Agent</th>
                        <th className="text-left pb-3 pr-4">Tier</th>
                        <th className="text-left pb-3 pr-4 min-w-[120px]">Score</th>
                        <th className="text-right pb-3 pr-4">Tasks</th>
                        <th className="text-right pb-3 pr-4">Unprompted Notes</th>
                        <th className="text-right pb-3 pr-4">Blockers Flagged</th>
                        <th className="text-right pb-3">Suggestions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.agents.map((agent) => (
                        <tr key={agent.agentId} className="text-gray-300">
                          <td className="py-3 pr-4 font-medium text-white">{agent.agentName}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_BADGE[agent.proactivityTier]}`}>
                              {agent.proactivityTier}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[80px]">
                                <div
                                  className="bg-amber-500 h-2 rounded-full"
                                  style={{ width: `${agent.proactivityScore}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">{agent.proactivityScore}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right">{agent.totalTasks}</td>
                          <td className="py-3 pr-4 text-right">{agent.unpromptedNoteCount}</td>
                          <td className="py-3 pr-4 text-right text-orange-400">{agent.blockerFlagCount}</td>
                          <td className="py-3 text-right text-amber-400">{agent.suggestionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Analysis section */}
              <div className="rounded-lg p-4 bg-gradient-to-br from-amber-900/20 to-yellow-900/20 border border-amber-700/30">
                <h3 className="text-sm font-semibold text-amber-300 mb-2">AI Analysis</h3>
                {data.aiSummary && (
                  <p className="text-sm text-gray-300 mb-3">{data.aiSummary}</p>
                )}
                {data.insights && data.insights.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-amber-400 mb-1">Insights</p>
                    <ul className="space-y-1">
                      {data.insights.map((insight, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">→</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(data.aiRecommendations ?? data.recommendations ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-400 mb-1">Recommendations</p>
                    <ul className="space-y-1">
                      {(data.aiRecommendations ?? data.recommendations).map((rec, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
