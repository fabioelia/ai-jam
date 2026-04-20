import type { AgentOutputConsistencyReport, AgentOutputConsistencyMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentOutputConsistencyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentOutputConsistencyMetrics['consistencyTier'], string> = {
  stable: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  'mostly-stable': 'bg-green-900/50 text-green-300 border border-green-700/50',
  variable: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  erratic: 'bg-red-900/50 text-red-400 border border-red-700/50',
};

export default function AgentOutputConsistencyModal({ result, isOpen, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            AI Agent Output Consistency Analyzer
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing output consistency...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No output consistency data available.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Consistency Score</p>
                  <p className="text-teal-200 text-sm font-semibold">{result.summary.avgConsistencyScore}</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Most Consistent</p>
                  <p className="text-teal-200 text-sm font-semibold truncate">{result.summary.mostConsistentAgent || '—'}</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">High Variance Agents</p>
                  <p className="text-teal-200 text-sm font-semibold">{result.summary.highVarianceAgents}</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-teal-200 text-sm font-semibold">{result.summary.totalAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Format Rate</th>
                      <th className="px-4 py-3 text-center">Variance</th>
                      <th className="px-4 py-3 text-center">Task Groups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_STYLES[agent.consistencyTier]}`}>
                            {agent.consistencyTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-teal-500 rounded-full" style={{ width: `${agent.consistencyScore}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-8 text-right">{agent.consistencyScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.formatConsistencyRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.outputLengthVariance}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.taskGroupsAnalyzed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(result.insights.length > 0 || result.recommendations.length > 0) && (
                <div className="space-y-3">
                  {result.insights.length > 0 && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-2">Insights</p>
                      <ul className="space-y-1">
                        {result.insights.map((ins, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-teal-400 shrink-0">•</span>{ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.recommendations.length > 0 && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-teal-400 shrink-0">•</span>{rec}
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
          <button onClick={onClose} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
