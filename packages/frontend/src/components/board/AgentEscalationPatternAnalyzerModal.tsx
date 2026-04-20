import type { AgentEscalationPatternAnalyzerReport, AgentEscalationPatternMetrics } from '../../api/mutations.js';

interface Props {
  data: AgentEscalationPatternAnalyzerReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_BADGE: Record<AgentEscalationPatternMetrics['escalationTier'], string> = {
  autonomous: 'bg-green-500/20 text-green-300 border-green-500/40',
  measured: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  dependent: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  'over-reliant': 'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function AgentEscalationPatternAnalyzerModal({ data, isOpen, loading, onClose }: Props) {
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
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            AI Agent Escalation Pattern Analyzer
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
                <span className="text-sm">Analyzing escalation patterns...</span>
              </div>
            </div>
          ) : !data || data.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No agent data available.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-amber-200 text-2xl font-bold">{data.summary.totalAgents}</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Escalation Score</p>
                  <p className="text-amber-200 text-2xl font-bold">{data.summary.avgEscalationScore}</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">Most Autonomous</p>
                  <p className="text-amber-200 text-sm font-semibold truncate">{data.summary.mostAutonomous || '—'}</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">Over-Reliant Agents</p>
                  <p className="text-amber-200 text-2xl font-bold">{data.summary.overReliantAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Escalation Rate</th>
                      <th className="px-4 py-3 text-center">Total Tasks</th>
                      <th className="px-4 py-3 text-center">Escalated</th>
                      <th className="px-4 py-3 text-center">Unnecessary</th>
                      <th className="px-4 py-3 text-center">Avg Resolution (min)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_BADGE[agent.escalationTier]}`}>
                            {agent.escalationTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-amber-500 rounded-full" style={{ width: `${agent.escalationScore}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-8 text-right">{agent.escalationScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.escalationRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.totalTasks}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.escalatedTasks}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.unnecessaryEscalations}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.avgResolutionTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(data.insights.length > 0 || data.recommendations.length > 0) && (
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-5 py-4 space-y-3">
                  {data.insights.length > 0 && (
                    <div>
                      <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-2">AI Analysis</p>
                      <ul className="space-y-1">
                        {data.insights.map((insight, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-amber-400 shrink-0">•</span>{insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.recommendations.length > 0 && (
                    <div>
                      <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {data.recommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-amber-400 shrink-0">•</span>{rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
