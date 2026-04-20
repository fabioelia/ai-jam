import type { CollaborationReport } from '../../api/mutations.js';

interface AgentCollaborationModalProps {
  result: CollaborationReport | null;
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

export default function AgentCollaborationModal({ result, isOpen, loading, onClose }: AgentCollaborationModalProps) {
  if (!isOpen) return null;

  const complexCount = result?.complexTickets.length ?? 0;
  const countBadgeClass = complexCount > 0
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
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
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            AI Agent Collaboration
            {result && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full border ${countBadgeClass}`}>
                {complexCount} complex {complexCount === 1 ? 'ticket' : 'tickets'}
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
              <svg className="w-8 h-8 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-3 text-gray-400">Analyzing agent collaboration...</span>
            </div>
          )}

          {!loading && result && result.complexTickets.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-300">No complex tickets requiring collaboration found!</p>
              <p className="text-sm mt-1">All tickets can be handled by individual agents.</p>
            </div>
          )}

          {!loading && result && result.complexTickets.length > 0 && (
            <div className="space-y-6">
              {result.complexTickets.map((ticket) => (
                <div key={ticket.ticketId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  {/* Ticket header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-white font-medium text-sm truncate flex-1">{ticket.ticketTitle}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${priorityBadgeClass(ticket.ticketPriority)}`}>
                      {ticket.ticketPriority}
                    </span>
                  </div>

                  {/* Specialization tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {ticket.detectedSpecializations.map((spec) => (
                      <span key={spec} className="text-xs px-2 py-0.5 rounded-full bg-slate-600/40 text-slate-300 border border-slate-600/50">
                        {spec}
                      </span>
                    ))}
                  </div>

                  {/* Recommended pairs */}
                  <div className="space-y-3">
                    {ticket.recommendedPairs.map((pair, index) => (
                      <div key={`${pair.primaryAgent}-${pair.secondaryAgent}`} className="rounded-lg border border-gray-700 overflow-hidden">
                        <div className="flex items-center gap-2 p-3 bg-gray-800/60">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-16 shrink-0">Primary</span>
                            <span className="text-sm font-medium px-2 py-0.5 rounded bg-purple-600/30 text-purple-200 border border-purple-600/40 truncate">
                              {pair.primaryAgent}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 shrink-0">Secondary</span>
                            <span className="text-sm font-medium px-2 py-0.5 rounded bg-slate-600/30 text-slate-200 border border-slate-600/40 truncate">
                              {pair.secondaryAgent}
                            </span>
                          </div>
                          <span className={`text-xs font-mono font-bold shrink-0 ${index === 0 ? 'text-purple-400' : 'text-gray-400'}`}>
                            {pair.collaborationScore}
                          </span>
                        </div>
                        <div className="px-3 py-2 border-t border-gray-700/50">
                          <p className="text-xs text-gray-400 italic mb-2">{pair.suggestedSplit}</p>
                          <div className="bg-purple-500/10 border border-purple-500/25 rounded p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">AI Rationale</span>
                            </div>
                            <p className="text-xs text-purple-200 leading-relaxed">{pair.rationale}</p>
                          </div>
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
