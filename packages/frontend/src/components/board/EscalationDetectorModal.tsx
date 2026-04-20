import type { EscalationReport, StaleTicket } from '../../api/mutations.js';

interface EscalationDetectorModalProps {
  result: EscalationReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function riskBadgeClass(riskLevel: StaleTicket['riskLevel']): string {
  switch (riskLevel) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
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

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EscalationDetectorModal({
  result,
  isOpen,
  loading,
  onClose,
}: EscalationDetectorModalProps) {
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
          <h2 className="text-white font-semibold text-lg flex items-center gap-3 flex-wrap">
            <svg
              className="w-5 h-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            Escalation Risk
            {result && (
              <>
                {result.criticalCount > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    {result.criticalCount} Critical
                  </span>
                )}
                {result.highCount > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    {result.highCount} High
                  </span>
                )}
                {result.mediumCount > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                    {result.mediumCount} Medium
                  </span>
                )}
              </>
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">Analyzing escalation risks...</span>
              </div>
            </div>
          ) : !result || result.staleTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg
                className="w-10 h-10 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-300 font-medium">No escalation risks detected.</p>
              <p className="text-gray-500 text-sm">All tickets are progressing within expected timelines.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.staleTickets.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2"
                >
                  {/* Top row: risk badge + title + priority */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize shrink-0 ${riskBadgeClass(ticket.riskLevel)}`}
                    >
                      {ticket.riskLevel}
                    </span>
                    <span className="text-white font-medium text-sm flex-1 min-w-0">
                      {ticket.title}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize shrink-0 ${priorityBadgeClass(ticket.priority)}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>

                  {/* Status + staleDays */}
                  <p className="text-xs text-gray-400">
                    {formatStatus(ticket.status)} &middot; {ticket.staleDays} {ticket.staleDays === 1 ? 'day' : 'days'} stale
                  </p>

                  {/* Assigned persona */}
                  <p className="text-xs text-gray-500">
                    Assigned to:{' '}
                    <span className="text-gray-300">
                      {ticket.assignedPersona ?? 'Unassigned'}
                    </span>
                  </p>

                  {/* Recommendation */}
                  <p className="text-xs text-gray-400 italic">{ticket.recommendation}</p>
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
