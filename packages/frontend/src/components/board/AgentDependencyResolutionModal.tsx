import type { AgentDependencyResolutionReport, AgentDependencyResolutionMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentDependencyResolutionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentDependencyResolutionMetrics['resolutionTier'], string> = {
  expert: 'bg-violet-900/50 text-violet-300 border border-violet-700/50',
  proficient: 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50',
  developing: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  struggling: 'bg-red-900/50 text-red-400 border border-red-700/50',
};

export default function AgentDependencyResolutionModal({ result, isOpen, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            AI Agent Dependency Resolution Analyzer
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
                <span className="text-sm">Analyzing dependency resolution...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-gray-400 text-sm">No dependency resolution data available.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Total Deps</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.totalDependencies}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Resolved Deps</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.resolvedDependencies}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Resolution Time</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.avgResolutionTimeHours}h</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Resolution Rate</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.dependencyResolutionRate}%</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Blocked Tickets</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.blockedTickets}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Circular Dependencies</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.circularDependencies}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Longest Block Chain</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.longestBlockChain}</p>
                </div>
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Resolution Rate</th>
                      <th className="px-4 py-3 text-center">Total Deps</th>
                      <th className="px-4 py-3 text-center">Resolved</th>
                      <th className="px-4 py-3 text-center">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_STYLES[agent.resolutionTier]}`}>
                            {agent.resolutionTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-violet-500 rounded-full" style={{ width: `${agent.resolutionScore}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-8 text-right">{agent.resolutionScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.dependencyResolutionRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.totalDependencies}</td>
                        <td className="px-4 py-3 text-center text-green-400 font-mono text-xs">{agent.resolvedDependencies}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.avgResolutionTime}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Blocked Tickets */}
              {result.blockedTicketDetails && result.blockedTicketDetails.length > 0 && (
                <div>
                  <h3 className="text-indigo-400 text-sm font-semibold mb-2">Blocked Tickets</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left">Ticket</th>
                          <th className="px-4 py-3 text-center">Blocked By (count)</th>
                          <th className="px-4 py-3 text-center">Wait Time</th>
                          <th className="px-4 py-3 text-center">Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {result.blockedTicketDetails.map((t, i) => (
                          <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 text-white font-medium">{t.ticketTitle}</td>
                            <td className="px-4 py-3 text-center text-gray-300">{t.blockedBy.length}</td>
                            <td className="px-4 py-3 text-center text-gray-300">{t.waitTimeHours}h</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                                t.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                                t.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                                t.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                                'bg-green-500/20 text-green-400 border-green-500/40'
                              }`}>{t.riskLevel}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* Circular Dependencies */}
              {result.circularDependencyChains && result.circularDependencyChains.length > 0 && (
                <div>
                  <h3 className="text-indigo-400 text-sm font-semibold mb-2">Circular Dependencies</h3>
                  {result.circularDependencyChains.map((c, i) => (
                    <div key={i} className="bg-red-900/20 border border-red-500/30 rounded p-2 mb-1 text-sm text-gray-300">
                      {c.chain.join(' → ')}
                    </div>
                  ))}
                </div>
              )}

              {/* Insights */}
              {(result.aiSummary || result.aiRecommendations?.length > 0) && (
                <div className="space-y-3">
                  {result.aiSummary && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-2">AI Summary</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{result.aiSummary}</p>
                    </div>
                  )}
                  {result.aiRecommendations?.length > 0 && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {result.aiRecommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-violet-400 shrink-0">•</span>
                            {rec}
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
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
