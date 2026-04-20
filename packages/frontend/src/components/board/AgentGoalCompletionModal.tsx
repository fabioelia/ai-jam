import type { AgentGoalCompletionReport, AgentGoalCompletionMetrics } from '../../api/mutations.js';

interface AgentGoalCompletionModalProps {
  result: AgentGoalCompletionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentGoalCompletionMetrics['completionTier']): string {
  switch (tier) {
    case 'exceptional': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'solid': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'partial': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'struggling': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

export default function AgentGoalCompletionModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentGoalCompletionModalProps) {
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
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            AI Agent Goal Completion Analyzer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing agent goal completion...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No agent session data available.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Total Goals</p>
                  <p className="text-purple-200 text-sm font-semibold">{result.summary.totalGoals}</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Overall Completion Rate</p>
                  <p className="text-purple-200 text-sm font-semibold">{result.summary.overallCompletionRate}%</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Top Performer</p>
                  <p className="text-purple-200 text-sm font-semibold">{result.summary.topPerformer || '—'}</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Exceptional Agents</p>
                  <p className="text-purple-200 text-sm font-semibold">{result.summary.exceptionalAgents}</p>
                </div>
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Completion Rate</th>
                      <th className="px-4 py-3 text-center">Partial Rate</th>
                      <th className="px-4 py-3 text-center">Failed</th>
                      <th className="px-4 py-3 text-center">Avg Goals/Session</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName || agent.agentId}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${tierBadgeClass(agent.completionTier)}`}>
                            {agent.completionTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[60px]">
                              <div
                                className="h-2 rounded-full bg-purple-500 transition-all"
                                style={{ width: `${Math.max(0, Math.min(100, agent.completionScore))}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-300 w-8 text-right">{agent.completionScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.completionRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{agent.partialRate}%</td>
                        <td className="px-4 py-3 text-center text-red-400">{agent.failed}</td>
                        <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{agent.avgGoalsPerSession}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Insights */}
              {(result.insights.length > 0 || result.recommendations.length > 0) && (
                <div className="bg-gradient-to-br from-purple-900/20 to-violet-900/20 border border-purple-500/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-purple-300 font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Insights
                  </h3>
                  {result.insights.map((insight, i) => (
                    <p key={i} className="text-purple-100/80 text-sm leading-relaxed">{insight}</p>
                  ))}
                  {result.recommendations.length > 0 && (
                    <ul className="space-y-1 mt-2">
                      {result.recommendations.map((rec, i) => (
                        <li key={i} className="text-purple-100/70 text-sm flex items-start gap-2">
                          <span className="text-purple-400 mt-0.5">•</span>
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

        {/* Footer */}
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
