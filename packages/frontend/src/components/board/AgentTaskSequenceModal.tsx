import type { TaskSequenceReport } from '../../api/mutations.js';

interface AgentTaskSequenceModalProps {
  result: TaskSequenceReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function priorityBadgeClass(priority: string | null): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-green-500/20 text-green-300 border-green-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export default function AgentTaskSequenceModal({ result, isOpen, loading, onClose }: AgentTaskSequenceModalProps) {
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
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Task Sequence
            {result && (
              <span className="text-sm font-normal text-gray-400">
                {result.totalAgents} agents · {result.totalTickets} tickets sequenced
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Sequencing tasks...</span>
              </div>
            </div>
          ) : !result || result.agentSequences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-sm">No assigned tickets to sequence.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {result.agentSequences.map((agent) => (
                <div key={agent.agentName} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-white font-semibold text-sm">{agent.agentName}</span>
                    <span className="text-xs text-gray-400">{agent.ticketCount} tickets</span>
                  </div>
                  <div className="divide-y divide-gray-700/50">
                    {agent.sequence.map((ticket, idx) => (
                      <div key={ticket.ticketId} className="px-4 py-3 flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center justify-center border border-indigo-500/40">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium truncate">{ticket.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${priorityBadgeClass(ticket.priority)}`}>
                              {ticket.priority ?? 'none'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300 border border-gray-600/40 capitalize">
                              {ticket.status.replace('_', ' ')}
                            </span>
                            {ticket.storyPoints != null && (
                              <span className="text-xs text-gray-400">{ticket.storyPoints} SP</span>
                            )}
                            <span className="text-xs text-gray-500">score: {ticket.score}</span>
                          </div>
                          {idx < 3 && (
                            <p className="text-xs text-gray-500 italic">{ticket.rationale}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
