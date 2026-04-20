import type { AgentDelegationDepthReport, AgentDelegationMetrics } from '../../api/mutations.js';

interface AgentDelegationDepthModalProps {
  data: AgentDelegationDepthReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentDelegationMetrics['delegationTier']): string {
  switch (tier) {
    case 'balanced': return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40';
    case 'over-delegator': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'under-delegator': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export default function AgentDelegationDepthModal({
  data,
  isOpen,
  loading,
  onClose,
}: AgentDelegationDepthModalProps) {
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
            <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Agent Delegation Depth Analyzer
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing delegation depth...</span>
              </div>
            </div>
          ) : !data || data.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-gray-400 text-sm">No delegation data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg px-4 py-3">
                  <p className="text-fuchsia-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-fuchsia-200 text-xl font-bold">{data.summary.totalAgents}</p>
                </div>
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg px-4 py-3">
                  <p className="text-fuchsia-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Delegation Rate</p>
                  <p className="text-fuchsia-200 text-xl font-bold">{data.summary.avgDelegationRate}%</p>
                </div>
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg px-4 py-3">
                  <p className="text-fuchsia-400 text-xs font-medium uppercase tracking-wide mb-1">Max Chain Depth</p>
                  <p className="text-fuchsia-200 text-xl font-bold">{data.summary.maxChainDepth}</p>
                </div>
                <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg px-4 py-3">
                  <p className="text-fuchsia-400 text-xs font-medium uppercase tracking-wide mb-1">Balanced Agents</p>
                  <p className="text-fuchsia-200 text-xl font-bold">{data.summary.balancedAgents}</p>
                </div>
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Delegation Rate</th>
                      <th className="px-4 py-3 text-center">Avg Depth</th>
                      <th className="px-4 py-3 text-center">Max Depth</th>
                      <th className="px-4 py-3 text-center">Direct Resolutions</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-fuchsia-500"
                                style={{ width: `${Math.min(100, agent.delegationRate)}%` }}
                              />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.delegationRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.avgHandoffDepth}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.maxHandoffDepth}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.directResolutions}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tierBadgeClass(agent.delegationTier)}`}>
                            {agent.delegationTier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Analysis section */}
              {(data.insights.length > 0 || data.recommendations.length > 0) && (
                <div className="bg-gradient-to-br from-fuchsia-900/20 to-purple-900/20 border border-fuchsia-500/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-fuchsia-300 font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </h3>
                  {data.insights.length > 0 && (
                    <ul className="space-y-1">
                      {data.insights.map((insight, i) => (
                        <li key={i} className="text-fuchsia-100/80 text-sm flex items-start gap-2">
                          <span className="text-fuchsia-400 mt-0.5">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  )}
                  {data.recommendations.length > 0 && (
                    <ul className="space-y-1">
                      {data.recommendations.map((rec, i) => (
                        <li key={i} className="text-fuchsia-100/70 text-sm flex items-start gap-2">
                          <span className="text-fuchsia-400 mt-0.5">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
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
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
