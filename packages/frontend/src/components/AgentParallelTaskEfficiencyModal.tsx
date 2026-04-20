import type { AgentParallelTaskReport, AgentParallelTaskMetrics } from '../api/mutations.js';

interface AgentParallelTaskEfficiencyModalProps {
  report: AgentParallelTaskReport | null;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentParallelTaskMetrics['efficiencyTier']): string {
  switch (tier) {
    case 'expert': return 'bg-blue-100 text-blue-800';
    case 'capable': return 'bg-green-100 text-green-800';
    case 'struggling': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-red-100 text-red-800';
  }
}

export default function AgentParallelTaskEfficiencyModal({
  report,
  onClose,
}: AgentParallelTaskEfficiencyModalProps) {
  const expertCount = report?.summary.expertAgents ?? 0;

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
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            AI Agent Parallel Task Efficiency
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!report || report.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No parallel task data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Total Tasks</p>
                  <p className="text-purple-200 text-sm font-semibold">{report.summary.totalTasks}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">Overall Parallel Rate</p>
                  <p className="text-blue-200 text-sm font-semibold">{report.summary.overallParallelRate}%</p>
                </div>
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg px-4 py-3">
                  <p className="text-indigo-400 text-xs font-medium uppercase tracking-wide mb-1">Most Efficient Agent</p>
                  <p className="text-indigo-200 text-sm font-semibold truncate">{report.summary.mostEfficientAgent || '—'}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Expert Agents</p>
                  <p className="text-violet-200 text-sm font-semibold">{expertCount}</p>
                </div>
              </div>

              {/* Agent Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center w-32">Score Bar</th>
                      <th className="px-4 py-3 text-center">Parallel Rate</th>
                      <th className="px-4 py-3 text-center">Max Concurrent</th>
                      <th className="px-4 py-3 text-center">Context Switches</th>
                      <th className="px-4 py-3 text-center">Parallel Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {report.agents.map((agent) => (
                      <tr key={agent.agentId} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-200 font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierBadgeClass(agent.efficiencyTier)}`}>
                            {agent.efficiencyTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${agent.efficiencyScore}%` }}
                              />
                            </div>
                            <span className="text-gray-400 text-xs w-8 text-right">{agent.efficiencyScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.parallelCompletionRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.maxConcurrentTasks}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.contextSwitches}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.parallelTasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Insights */}
              {report.insights.length > 0 && (
                <div className="bg-gray-800/40 rounded-lg p-4 space-y-2">
                  <h3 className="text-gray-300 text-sm font-medium">Insights</h3>
                  <ul className="space-y-1">
                    {report.insights.map((insight, i) => (
                      <li key={i} className="text-gray-400 text-sm flex gap-2">
                        <span className="text-purple-400 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Recommendations */}
              {report.aiRecommendations.length > 0 && (
                <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4 space-y-2">
                  <h3 className="text-purple-300 text-sm font-medium">AI Recommendations</h3>
                  <ul className="space-y-1">
                    {report.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-gray-400 text-sm flex gap-2">
                        <span className="text-purple-400 mt-0.5">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
