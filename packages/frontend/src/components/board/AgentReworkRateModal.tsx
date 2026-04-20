import type { ReworkRateReport, AgentReworkMetrics } from '../../api/mutations.js';

interface AgentReworkRateModalProps {
  result: ReworkRateReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentReworkMetrics['qualityTier']): string {
  switch (tier) {
    case 'excellent': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'good': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'fair': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function reworkBarWidth(reworkRate: number): string {
  return `${Math.min(100, reworkRate)}%`;
}

export default function AgentReworkRateModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentReworkRateModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Agent Rework Rate Analyzer
            {result && (
              <span className="text-sm font-normal text-red-400/80 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                system {result.systemReworkRate}% rework
              </span>
            )}
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
                <span className="text-sm">Analyzing rework rates...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-gray-400 text-sm">No rework data found. Agents are doing great or no tickets have been processed yet.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">System Rework Rate</p>
                  <p className="text-red-200 text-xl font-bold">{result.systemReworkRate}%</p>
                </div>
                {result.lowestReworkAgent && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                    <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Lowest Rework (Best)</p>
                    <p className="text-green-200 text-sm font-semibold truncate">{result.lowestReworkAgent}</p>
                  </div>
                )}
                {result.highestReworkAgent && (
                  <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                    <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Highest Rework (Worst)</p>
                    <p className="text-orange-200 text-sm font-semibold truncate">{result.highestReworkAgent}</p>
                  </div>
                )}
                <div className="bg-gray-800/60 border border-gray-600/40 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Rework Events</p>
                  <p className="text-gray-200 text-xl font-bold">{result.totalReworkEvents}</p>
                </div>
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Persona</th>
                      <th className="px-4 py-3 text-center">Quality Tier</th>
                      <th className="px-4 py-3 text-center">Rework Rate</th>
                      <th className="px-4 py-3 text-center">Total Worked</th>
                      <th className="px-4 py-3 text-center">Rework Count</th>
                      <th className="px-4 py-3 text-center">From Review</th>
                      <th className="px-4 py-3 text-center">From QA</th>
                      <th className="px-4 py-3 text-center">From Acceptance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.personaId}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${tierBadgeClass(agent.qualityTier)}`}>
                            {agent.qualityTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-400"
                                style={{ width: reworkBarWidth(agent.reworkRate) }}
                              />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.reworkRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalTicketsWorked}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.reworkCount}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.reworkSourceBreakdown.fromReview}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.reworkSourceBreakdown.fromQA}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.reworkSourceBreakdown.fromAcceptance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI summary + recommendations */}
              <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-red-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-red-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                {result.aiRecommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-red-100/70 text-sm flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
