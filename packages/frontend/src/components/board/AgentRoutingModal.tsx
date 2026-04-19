import type { RoutingReport } from '../../api/mutations.js';

interface AgentRoutingModalProps {
  result: RoutingReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
  }
}

export default function AgentRoutingModal({ result, isOpen, loading, onClose }: AgentRoutingModalProps) {
  if (!isOpen) return null;

  const unassignedCount = result?.unassignedCount ?? 0;
  const unassignedBadgeClass = unassignedCount > 0
    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
    : 'bg-gray-500/20 text-gray-400 border-gray-500/40';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            AI Agent Routing
            {result && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full border ${unassignedBadgeClass}`}>
                {unassignedCount} unassigned
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-3 text-gray-400">Analyzing agent routing...</span>
            </div>
          )}

          {!loading && result && result.recommendations.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-300">No unassigned tickets to route!</p>
              <p className="text-sm mt-1">All tickets are already assigned to agents.</p>
            </div>
          )}

          {!loading && result && result.recommendations.length > 0 && (
            <>
              {/* Recommendations */}
              <div className="space-y-4">
                {result.recommendations.map((rec) => (
                  <div key={rec.ticketId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-white font-medium text-sm truncate flex-1">{rec.ticketTitle}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${priorityBadgeClass(rec.ticketPriority)}`}>
                        {rec.ticketPriority}
                      </span>
                    </div>

                    {rec.rankedAgents.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No agents available for routing</p>
                    ) : (
                      <div className="space-y-2">
                        {rec.rankedAgents.map((agent, index) => (
                          <div
                            key={agent.agentName}
                            className={`rounded-lg p-3 border ${
                              index === 0
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-gray-800/50 border-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium ${index === 0 ? 'text-green-300' : 'text-gray-300'}`}>
                                {index === 0 && <span className="mr-1 text-green-400">★</span>}
                                {agent.agentName}
                              </span>
                              <span className={`text-xs font-mono ${index === 0 ? 'text-green-400' : 'text-gray-400'}`}>
                                score: {agent.score.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">{agent.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* AI Rationale */}
              {result.rationale && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">AI Routing Rationale</span>
                  </div>
                  <p className="text-sm text-indigo-200 leading-relaxed">{result.rationale}</p>
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
