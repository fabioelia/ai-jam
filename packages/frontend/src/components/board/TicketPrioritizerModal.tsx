import type { PrioritizationResult } from '../../api/mutations.js';

interface TicketPrioritizerModalProps {
  result: PrioritizationResult;
  projectName: string;
  onClose: () => void;
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
  if (rank === 2) return 'bg-gray-400/20 text-gray-300 border-gray-400/50';
  if (rank === 3) return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
  return 'bg-gray-700/20 text-gray-400 border-gray-600/50';
}

function miniBarColor(score: number): string {
  if (score >= 70) return 'bg-indigo-400';
  if (score >= 40) return 'bg-indigo-500';
  return 'bg-gray-600';
}

export default function TicketPrioritizerModal({ result, projectName, onClose }: TicketPrioritizerModalProps) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m-9 4h5m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            AI Ticket Prioritizer
            <span className="text-gray-500 text-sm font-normal">— {result.totalTickets} tickets</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {result.rankedTickets.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-sm">No backlog tickets to prioritize.</p>
            </div>
          ) : (
            <>
              {/* Rationale Summary */}
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                <p className="text-indigo-200 text-sm">{result.rationaleSummary}</p>
              </div>

              {/* Ranked List */}
              <div className="space-y-4">
                {result.rankedTickets.map((ticket) => (
                  <div key={ticket.ticketId} className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${rankBadgeColor(ticket.priorityRank)}`}>
                        #{ticket.priorityRank}
                      </span>
                      <span className="text-white font-medium text-sm flex-1 truncate">{ticket.ticketTitle}</span>
                      <span className="text-gray-500 text-xs px-1.5 py-0.5 rounded bg-gray-800">{ticket.ticketStatus}</span>
                    </div>

                    {/* Priority score bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 w-10">Score</span>
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${ticket.priorityScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-indigo-400 font-mono">{ticket.priorityScore}</span>
                    </div>

                    {/* Dimension mini bars 2x2 */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-10">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${miniBarColor(ticket.dimensions.impact)} rounded-full`} style={{ width: `${ticket.dimensions.impact}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">impact</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${miniBarColor(ticket.dimensions.urgency)} rounded-full`} style={{ width: `${ticket.dimensions.urgency}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">urgency</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${miniBarColor(ticket.dimensions.dependency)} rounded-full`} style={{ width: `${ticket.dimensions.dependency}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">depend</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full ${miniBarColor(ticket.dimensions.readiness)} rounded-full`} style={{ width: `${ticket.dimensions.readiness}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">ready</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 italic mt-1 ml-10">{ticket.rationale}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
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
