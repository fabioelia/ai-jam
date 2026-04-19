import type { AgentPerformanceReport, AgentMetrics } from '../../api/mutations.js';

interface AgentPerformanceModalProps {
  result: AgentPerformanceReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentMetrics['performanceTier']): string {
  switch (tier) {
    case 'high': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export default function AgentPerformanceModal({ result, isOpen, loading, onClose }: AgentPerformanceModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            AI Agent Performance
            {result?.topPerformer && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
                Top: {result.topPerformer}
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing agent performance...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No agent assignments found.</p>
            </div>
          ) : (
            <>
              {/* Agent Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.agents.map((agent) => (
                  <div
                    key={agent.agentName}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3"
                  >
                    {/* Agent Name + Tier */}
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-sm">{agent.agentName}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${tierBadgeClass(agent.performanceTier)}`}>
                        {agent.performanceTier}
                      </span>
                    </div>

                    {/* Completion Rate */}
                    <div className="text-center">
                      <span className="text-3xl font-bold text-white">{agent.completionRate}%</span>
                      <p className="text-xs text-gray-500 mt-0.5">completion rate</p>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Done</p>
                        <p className="text-sm font-semibold text-green-300">{agent.completedTickets}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">In Progress</p>
                        <p className="text-sm font-semibold text-yellow-300">{agent.inProgressTickets}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Story Pts</p>
                        <p className="text-sm font-semibold text-purple-300">{agent.totalStoryPointsDelivered}</p>
                      </div>
                    </div>

                    {/* Top Ticket Types */}
                    {agent.topTicketTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.topTicketTypes.map((type) => (
                          <span
                            key={type}
                            className={`text-xs px-2 py-0.5 rounded-full border capitalize ${priorityBadgeClass(type)}`}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* AI Insight */}
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">AI Insight</span>
                </div>
                <p className="text-sm text-indigo-200 leading-relaxed">{result.insight}</p>
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
