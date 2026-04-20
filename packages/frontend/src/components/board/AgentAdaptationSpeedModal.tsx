import type { AgentAdaptationSpeedReport, AgentAdaptationMetrics } from '../../api/mutations.js';

interface AgentAdaptationSpeedModalProps {
  report: AgentAdaptationSpeedReport | null;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentAdaptationMetrics['adaptationTier']): string {
  switch (tier) {
    case 'rapid': return 'bg-cyan-100 text-cyan-800';
    case 'responsive': return 'bg-blue-100 text-blue-800';
    case 'gradual': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-red-100 text-red-800';
  }
}

export default function AgentAdaptationSpeedModal({
  report,
  onClose,
}: AgentAdaptationSpeedModalProps) {
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
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Agent Adaptation Speed Analyzer
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
              <p className="text-gray-400 text-sm">No adaptation data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-cyan-200 text-sm font-semibold">{report.summary.totalAgents}</p>
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Adaptation Score</p>
                  <p className="text-cyan-200 text-sm font-semibold">{report.summary.avgAdaptationScore}</p>
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Fastest Adapter</p>
                  <p className="text-cyan-200 text-sm font-semibold truncate">{report.summary.fastestAdapter || '—'}</p>
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Rapid Adapters</p>
                  <p className="text-cyan-200 text-sm font-semibold">{report.summary.rapidAdapters}</p>
                </div>
              </div>

              {/* Agent Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Handoffs</th>
                      <th className="px-4 py-3 text-center">Feedback Rate</th>
                      <th className="px-4 py-3 text-center">Avg Iterations</th>
                      <th className="px-4 py-3 text-center">Req Changes</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {report.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalHandoffs}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.feedbackIncorporationRate.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.avgIterationsToSuccess.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.requirementChangeCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${agent.adaptationScore}%` }} />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.adaptationScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${tierBadgeClass(agent.adaptationTier)}`}>
                            {agent.adaptationTier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Analysis */}
              <div className="bg-cyan-900/20 border border-cyan-800 rounded-lg p-4 space-y-3">
                <h3 className="text-cyan-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Analysis
                </h3>
                {report.insights.length > 0 && (
                  <ul className="space-y-1">
                    {report.insights.map((insight, i) => (
                      <li key={i} className="text-cyan-100/80 text-sm flex items-start gap-2">
                        <span className="text-cyan-400 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                )}
                {report.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cyan-800/50">
                    <h4 className="text-cyan-300 font-medium text-xs uppercase tracking-wide mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="text-cyan-100/70 text-sm flex items-start gap-2">
                          <span className="text-cyan-400 mt-0.5">→</span>
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

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
