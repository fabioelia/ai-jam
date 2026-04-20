import type { KnowledgeGapReport, PriorityGap } from '../../api/mutations.js';

interface AgentKnowledgeGapModalProps {
  result: KnowledgeGapReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function severityBadgeClass(severity: PriorityGap['gapSeverity']): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'moderate': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'none': return 'bg-green-500/20 text-green-300 border-green-500/40';
  }
}

function priorityLabelClass(priority: PriorityGap['priority']): string {
  switch (priority) {
    case 'critical': return 'text-red-300';
    case 'high': return 'text-orange-300';
    case 'medium': return 'text-yellow-300';
    case 'low': return 'text-gray-300';
  }
}

export default function AgentKnowledgeGapModal({ result, isOpen, loading, onClose }: AgentKnowledgeGapModalProps) {
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
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            AI Agent Knowledge Gap Analysis
            {result?.topGap ? (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 capitalize">
                Top gap: {result.topGap}
              </span>
            ) : result && !loading ? (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
                No gaps
              </span>
            ) : null}
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
                <span className="text-sm">Analyzing knowledge gaps...</span>
              </div>
            </div>
          ) : !result || result.gaps.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No open tickets — nothing to analyze.</p>
            </div>
          ) : (
            <>
              {/* Gap Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.gaps.map((gap) => {
                  const assigned = gap.openTickets - gap.unassignedCount;
                  const coverageRatio = gap.openTickets > 0 ? assigned / gap.openTickets : 0;
                  const coveragePct = Math.round(coverageRatio * 100);

                  return (
                    <div
                      key={gap.priority}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3"
                    >
                      {/* Priority label + severity badge */}
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm capitalize ${priorityLabelClass(gap.priority)}`}>
                          {gap.priority}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${severityBadgeClass(gap.gapSeverity)}`}>
                          {gap.gapSeverity}
                        </span>
                      </div>

                      {/* Ticket counts */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Open Tickets</p>
                          <p className="text-sm font-semibold text-white">{gap.openTickets}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Unassigned</p>
                          <p className={`text-sm font-semibold ${gap.unassignedCount > 0 ? 'text-red-300' : 'text-green-300'}`}>
                            {gap.unassignedCount}
                          </p>
                        </div>
                      </div>

                      {/* Assigned agents */}
                      {gap.assignedAgents.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {gap.assignedAgents.map((agent) => (
                            <span
                              key={agent}
                              className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-300 border-blue-500/40"
                            >
                              {agent}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">No agents assigned</p>
                      )}

                      {/* Coverage progress bar */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Coverage</span>
                          <span>{coveragePct}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-green-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${coveragePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
