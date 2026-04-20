import type { AgentKnowledgeGapReport, AgentKnowledgeGapMetrics, DomainGap } from '../../api/mutations.js';

interface Props {
  data: AgentKnowledgeGapReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_BADGE: Record<AgentKnowledgeGapMetrics['proficiencyTier'], string> = {
  specialist: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  generalist: 'bg-green-500/20 text-green-300 border-green-500/40',
  developing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  struggling: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const SEVERITY_BADGE: Record<DomainGap['gapSeverity'], string> = {
  none: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  minor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  moderate: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function AgentKnowledgeGapModal({ data, isOpen, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Agent Knowledge Gap Analyzer
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
                <span className="text-sm">Analyzing knowledge gaps...</span>
              </div>
            </div>
          ) : !data || data.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No agent data available.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-orange-200 text-2xl font-bold">{data.summary.totalAgents}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Critical Gaps</p>
                  <p className="text-orange-200 text-2xl font-bold">{data.summary.criticalGapCount}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Most Struggling</p>
                  <p className="text-orange-200 text-sm font-semibold truncate">{data.summary.mostStruggling || '—'}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Most Covered Domain</p>
                  <p className="text-orange-200 text-sm font-semibold truncate capitalize">{data.summary.mostCoveredDomain || '—'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {data.agents.map((agent) => (
                  <div key={agent.agentId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">{agent.agentName}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_BADGE[agent.proficiencyTier]}`}>
                          {agent.proficiencyTier}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-700 rounded-full h-2">
                            <div className="h-2 bg-orange-500 rounded-full" style={{ width: `${agent.avgDomainScore}%` }} />
                          </div>
                          <span className="text-gray-300 font-mono text-xs">{agent.avgDomainScore}</span>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded border border-gray-700">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-800 text-gray-400 uppercase tracking-wide">
                            <th className="px-3 py-2 text-left">Domain</th>
                            <th className="px-3 py-2 text-center">Tasks</th>
                            <th className="px-3 py-2 text-center">Success Rate</th>
                            <th className="px-3 py-2 text-center">Avg Retries</th>
                            <th className="px-3 py-2 text-center">Escalation Rate</th>
                            <th className="px-3 py-2 text-center">Score</th>
                            <th className="px-3 py-2 text-center">Severity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {agent.domains.map((d) => (
                            <tr key={d.domain} className="hover:bg-gray-800/30">
                              <td className="px-3 py-2 text-gray-200 capitalize">{d.domain}</td>
                              <td className="px-3 py-2 text-center text-gray-300 font-mono">{d.tasksAttempted}</td>
                              <td className="px-3 py-2 text-center text-gray-300 font-mono">{d.successRate}%</td>
                              <td className="px-3 py-2 text-center text-gray-300 font-mono">{d.avgRetriesPerTask.toFixed(1)}</td>
                              <td className="px-3 py-2 text-center text-gray-300 font-mono">{d.escalationRate}%</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                    <div className="h-1.5 bg-orange-500 rounded-full" style={{ width: `${d.knowledgeScore}%` }} />
                                  </div>
                                  <span className="font-mono text-gray-300">{d.knowledgeScore}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_BADGE[d.gapSeverity]}`}>
                                  {d.gapSeverity}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {(data.insights.length > 0 || data.recommendations.length > 0) && (
                <div className="bg-gradient-to-r from-orange-500/20 to-orange-900/20 border border-orange-500/30 rounded-lg px-5 py-4 space-y-3">
                  {data.insights.length > 0 && (
                    <div>
                      <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-2">Insights</p>
                      <ul className="space-y-1">
                        {data.insights.map((insight, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-orange-400 shrink-0">•</span>{insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.recommendations.length > 0 && (
                    <div>
                      <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {data.recommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-orange-400 shrink-0">•</span>{rec}
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
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
