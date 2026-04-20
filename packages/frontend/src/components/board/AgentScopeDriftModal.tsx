import type { AgentScopeDriftReport, AgentScopeDriftMetrics } from '../../api/mutations.js';

interface AgentScopeDriftModalProps {
  report: AgentScopeDriftReport | null;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentScopeDriftMetrics['adherenceTier']): string {
  switch (tier) {
    case 'focused': return 'bg-lime-100 text-lime-800';
    case 'contained': return 'bg-green-100 text-green-800';
    case 'expanding': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-red-100 text-red-800';
  }
}

export default function AgentScopeDriftModal({
  report,
  onClose,
}: AgentScopeDriftModalProps) {
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
            <svg className="w-5 h-5 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Agent Scope Drift Detector
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
              <p className="text-gray-400 text-sm">No scope drift data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-lime-900/20 border border-lime-500/30 rounded-lg px-4 py-3">
                  <p className="text-lime-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-lime-200 text-sm font-semibold">{report.summary.totalAgents}</p>
                </div>
                <div className="bg-lime-900/20 border border-lime-500/30 rounded-lg px-4 py-3">
                  <p className="text-lime-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Adherence Score</p>
                  <p className="text-lime-200 text-sm font-semibold">{report.summary.avgAdherenceScore}</p>
                </div>
                <div className="bg-lime-900/20 border border-lime-500/30 rounded-lg px-4 py-3">
                  <p className="text-lime-400 text-xs font-medium uppercase tracking-wide mb-1">Most Focused</p>
                  <p className="text-lime-200 text-sm font-semibold truncate">{report.summary.mostFocused || '—'}</p>
                </div>
                <div className="bg-lime-900/20 border border-lime-500/30 rounded-lg px-4 py-3">
                  <p className="text-lime-400 text-xs font-medium uppercase tracking-wide mb-1">Focused Agents</p>
                  <p className="text-lime-200 text-sm font-semibold">{report.summary.focusedAgents}</p>
                </div>
              </div>

              {/* Agent Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tasks</th>
                      <th className="px-4 py-3 text-center">Out-of-Scope</th>
                      <th className="px-4 py-3 text-center">Adherence Rate</th>
                      <th className="px-4 py-3 text-center">Drift Incidents</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {report.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalTasks}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.outOfScopeTaskCount}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.scopeAdherenceRate.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.driftIncidents}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-lime-500" style={{ width: `${agent.adherenceScore}%` }} />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.adherenceScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${tierBadgeClass(agent.adherenceTier)}`}>
                            {agent.adherenceTier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Analysis */}
              <div className="bg-lime-900/20 border border-lime-800 rounded-lg p-4 space-y-3">
                <h3 className="text-lime-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Analysis
                </h3>
                {report.insights.length > 0 && (
                  <ul className="space-y-1">
                    {report.insights.map((insight, i) => (
                      <li key={i} className="text-lime-100/80 text-sm flex items-start gap-2">
                        <span className="text-lime-400 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                )}
                {report.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-lime-800/50">
                    <h4 className="text-lime-300 font-medium text-xs uppercase tracking-wide mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="text-lime-100/70 text-sm flex items-start gap-2">
                          <span className="text-lime-400 mt-0.5">→</span>
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
