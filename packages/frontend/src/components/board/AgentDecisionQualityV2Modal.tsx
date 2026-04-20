import type { AgentDecisionQualityMetrics, AgentDecisionQualityReportV2 } from '../../api/mutations.js';

interface AgentDecisionQualityV2ModalProps {
  result: AgentDecisionQualityReportV2 | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadge(tier: AgentDecisionQualityMetrics['qualityTier']): string {
  switch (tier) {
    case 'excellent': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'good': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'improving': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'struggling': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function tierLabel(tier: AgentDecisionQualityMetrics['qualityTier']): string {
  switch (tier) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'improving': return 'Improving';
    case 'struggling': return 'Struggling';
  }
}

export default function AgentDecisionQualityV2Modal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentDecisionQualityV2ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Agent Decision Quality Analyzer
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Analyzing decision quality...</span>
              </div>
            </div>
          ) : !result ? null : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Total Decisions</p>
                  <p className="text-teal-200 text-xl font-bold">{result.summary.totalDecisions}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Top Decision Maker</p>
                  <p className="text-white text-sm font-semibold truncate">{result.summary.topDecisionMaker ?? 'N/A'}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Correctness Rate</p>
                  <p className="text-white text-xl font-bold">{result.summary.avgCorrectnessRate.toFixed(1)}%</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">High Quality Agents</p>
                  <p className="text-green-200 text-xl font-bold">{result.summary.highQualityAgents}</p>
                </div>
              </div>

              {/* Agents Table */}
              {result.agents.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-400 text-sm italic">No agent data available — assign tickets to begin tracking.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-400 font-medium">Agent</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Decisions</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Correctness</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Revision Rate</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Impact Score</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Quality Score</th>
                        <th className="text-center py-2 px-3 text-gray-400 font-medium">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.agents.map((agent) => (
                        <tr key={agent.agentId} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-3 text-white font-medium">{agent.agentName}</td>
                          <td className="py-3 px-3 text-gray-300 text-right">{agent.totalDecisions}</td>
                          <td className="py-3 px-3 text-gray-300 text-right">{agent.correctnessRate.toFixed(1)}%</td>
                          <td className="py-3 px-3 text-gray-300 text-right">{agent.revisionRate.toFixed(1)}%</td>
                          <td className="py-3 px-3 text-gray-300 text-right">{agent.impactScore.toFixed(1)}</td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-teal-500 transition-all"
                                  style={{ width: `${Math.min(100, agent.qualityScore)}%` }}
                                />
                              </div>
                              <span className="text-gray-200 text-xs w-10 text-right">{agent.qualityScore.toFixed(0)}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tierBadge(agent.qualityTier)}`}>
                              {tierLabel(agent.qualityTier)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Insights & Recommendations */}
              {(result.insights.length > 0 || result.recommendations.length > 0) && (
                <div className="bg-gradient-to-br from-teal-900/20 to-gray-800/30 border border-teal-500/20 rounded-lg p-4 space-y-3">
                  <h3 className="text-teal-300 font-medium text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    AI Analysis
                  </h3>
                  {result.insights.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wide">Insights</p>
                      <ul className="space-y-1">
                        {result.insights.map((insight, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-teal-400 mt-0.5">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.recommendations.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wide">Recommendations</p>
                      <ul className="space-y-1">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-teal-400 mt-0.5">→</span>
                            <span>{rec}</span>
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
