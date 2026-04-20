import type { AgentCognitiveLoadReport, AgentCognitiveLoadMetrics } from '../api/mutations.js';

interface AgentCognitiveLoadModalProps {
  report: AgentCognitiveLoadReport | null;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentCognitiveLoadMetrics['loadTier']): string {
  switch (tier) {
    case 'critical': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'moderate': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-green-100 text-green-800';
  }
}

export default function AgentCognitiveLoadModal({
  report,
  onClose,
}: AgentCognitiveLoadModalProps) {
  const criticalCount = report?.agents.filter((a) => a.loadTier === 'critical').length ?? 0;

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
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Agent Cognitive Load Analyzer
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
              <p className="text-gray-400 text-sm">No cognitive load data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents Analyzed</p>
                  <p className="text-orange-200 text-sm font-semibold">{report.agents.length}</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-3">
                  <p className="text-yellow-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Cognitive Load Score</p>
                  <p className="text-yellow-200 text-sm font-semibold">{report.avgCognitiveLoadScore}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Most Overloaded Agent</p>
                  <p className="text-red-200 text-sm font-semibold truncate">{report.mostOverloadedAgent || '—'}</p>
                </div>
                <div className="bg-rose-900/20 border border-rose-500/30 rounded-lg px-4 py-3">
                  <p className="text-rose-400 text-xs font-medium uppercase tracking-wide mb-1">Critical Load Agents</p>
                  <p className="text-rose-200 text-sm font-semibold">{criticalCount}</p>
                </div>
              </div>

              {/* Agent Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Persona</th>
                      <th className="px-4 py-3 text-center">Load Tier</th>
                      <th className="px-4 py-3 text-center">Score Bar</th>
                      <th className="px-4 py-3 text-center">Concurrent Tasks</th>
                      <th className="px-4 py-3 text-center">Context Switches</th>
                      <th className="px-4 py-3 text-center">Avg Token Budget</th>
                      <th className="px-4 py-3 text-center">Complex Task %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {report.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.personaId}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${tierBadgeClass(agent.loadTier)}`}>
                            {agent.loadTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${agent.cognitiveLoadScore}%` }} />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.cognitiveLoadScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.avgConcurrentTasks}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.contextSwitches}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.avgTokenBudget}</td>
                        <td className="px-4 py-3 text-center text-gray-300">
                          {(agent.complexTaskRatio * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Section */}
              <div className="bg-gradient-to-br from-orange-900/20 to-amber-900/20 border border-orange-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-orange-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-orange-100/80 text-sm leading-relaxed">{report.aiSummary}</p>
                {report.aiRecommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-orange-500/20">
                    <h4 className="text-orange-300 font-medium text-xs uppercase tracking-wide mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {report.aiRecommendations.map((rec, i) => (
                        <li key={i} className="text-orange-100/70 text-sm flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">→</span>
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
