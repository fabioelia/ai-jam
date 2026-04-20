import type {
  AgentFeedbackIncorporationReport,
  AgentFeedbackIncorporationData,
} from '../../api/mutations.js';

interface Props {
  result: AgentFeedbackIncorporationReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentFeedbackIncorporationData['incorporationTier']): string {
  switch (tier) {
    case 'excellent': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'good': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'improving': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

export default function AgentFeedbackIncorporationModal({ result, isOpen, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Feedback Incorporation Analyzer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && !result && (
            <div className="text-center py-16 text-gray-500">No data available. Run analysis to begin.</div>
          )}

          {!loading && result && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 border border-teal-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Avg Incorporation Rate</p>
                  <p className="text-2xl font-bold text-teal-400">{result.avgProjectIncorporationRate.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800/50 border border-teal-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Best Incorporator</p>
                  <p className="text-lg font-semibold text-white truncate">
                    {result.bestIncorporator ?? '—'}
                  </p>
                </div>
                <div className="bg-gray-800/50 border border-teal-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Most Struggling</p>
                  <p className="text-lg font-semibold text-white truncate">
                    {result.mostStrugglingAgent ?? '—'}
                  </p>
                </div>
                <div className="bg-gray-800/50 border border-teal-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Repeat Feedback Agents</p>
                  <p className="text-2xl font-bold text-teal-400">{result.agentsWithRepeatFeedback}</p>
                </div>
              </div>

              {/* Agent Table */}
              {result.agents.length > 0 && (
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-700/50">
                    <h3 className="text-white font-medium text-sm">Agent Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Agent</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Tier</th>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium w-32">Score</th>
                          <th className="text-right px-4 py-2 text-gray-400 font-medium">Inc. Rate</th>
                          <th className="text-right px-4 py-2 text-gray-400 font-medium">Avg Iter.</th>
                          <th className="text-right px-4 py-2 text-gray-400 font-medium">Repeat</th>
                          <th className="text-right px-4 py-2 text-gray-400 font-medium">Fast Inc.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.agents.map((agent) => (
                          <tr key={agent.personaId} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                            <td className="px-4 py-3 text-white font-medium truncate max-w-[160px]">{agent.personaId}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs border font-medium ${tierBadgeClass(agent.incorporationTier)}`}>
                                {agent.incorporationTier}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className="bg-teal-500 h-1.5 rounded-full transition-all"
                                    style={{ width: `${agent.incorporationScore}%` }}
                                  />
                                </div>
                                <span className="text-gray-300 text-xs w-8 text-right">{agent.incorporationScore}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300">{agent.incorporationRate.toFixed(1)}%</td>
                            <td className="px-4 py-3 text-right text-gray-300">{agent.avgIterationsToApproval.toFixed(1)}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{agent.repeatFeedbackCount}</td>
                            <td className="px-4 py-3 text-right text-gray-300">{agent.fastIncorporationCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* AI Section */}
              {(result.aiSummary || result.aiRecommendations?.length > 0) && (
                <div className="bg-teal-500/5 border border-teal-500/20 rounded-lg p-5 space-y-3">
                  <h3 className="text-teal-400 font-medium text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Analysis
                  </h3>
                  {result.aiSummary && (
                    <p className="text-gray-300 text-sm leading-relaxed">{result.aiSummary}</p>
                  )}
                  {result.aiRecommendations?.length > 0 && (
                    <ul className="space-y-1">
                      {result.aiRecommendations.map((rec, i) => (
                        <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                          <span className="text-teal-500 mt-0.5">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
