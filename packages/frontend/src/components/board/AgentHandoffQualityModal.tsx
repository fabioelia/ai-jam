import type { HandoffQualityReport, HandoffQualityScore } from '../../api/mutations.js';

interface AgentHandoffQualityModalProps {
  result: HandoffQualityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function avgScoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-500/20 text-green-300 border-green-500/40';
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (score >= 40) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  return 'bg-red-500/20 text-red-300 border-red-500/40';
}

function gradeBadgeClass(grade: HandoffQualityScore['grade']): string {
  switch (grade) {
    case 'excellent': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'good': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'needs-improvement': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'poor': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function severityPillClass(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'medium': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export default function AgentHandoffQualityModal({ result, isOpen, loading, onClose }: AgentHandoffQualityModalProps) {
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
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Agent Handoff Quality
            {result && !loading && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full border ${avgScoreBadgeClass(result.averageScore)}`}>
                Avg: {result.averageScore}
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
                <span className="text-sm">Analyzing handoff quality...</span>
              </div>
            </div>
          ) : !result || result.totalHandoffs === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No handoffs found for quality analysis.</p>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Excellent', count: result.excellentCount, cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
                  { label: 'Good', count: result.goodCount, cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
                  { label: 'Needs Improvement', count: result.needsImprovementCount, cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
                  { label: 'Poor', count: result.poorCount, cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
                ].map(({ label, count, cls }) => (
                  <div key={label} className={`rounded-lg border p-3 text-center ${cls}`}>
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs mt-0.5 opacity-80">{label}</p>
                  </div>
                ))}
              </div>

              {/* Top Issues */}
              {result.topIssues.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Top Issues</h3>
                  <div className="space-y-2">
                    {result.topIssues.map(({ category, count }) => (
                      <div key={category} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-2">
                        <span className="text-sm text-gray-300 capitalize">{category.replace(/-/g, ' ')}</span>
                        <span className="text-xs font-medium bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Handoff Cards */}
              <div className="space-y-4">
                {result.handoffs.map((handoff) => (
                  <div key={handoff.handoffId} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                    {/* Ticket + agents */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{handoff.ticketTitle}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {handoff.fromAgent} → {handoff.toAgent}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${gradeBadgeClass(handoff.grade)}`}>
                          {handoff.score}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${gradeBadgeClass(handoff.grade)}`}>
                          {handoff.grade.replace('-', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Issue pills */}
                    {handoff.issues.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {handoff.issues.map((issue, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-0.5 rounded-full border capitalize ${severityPillClass(issue.severity)}`}
                            title={issue.description}
                          >
                            {issue.category.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* AI suggestion */}
                    {handoff.grade !== 'excellent' && handoff.suggestions.length > 0 && (
                      <div className="bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span className="text-xs font-medium text-cyan-300 uppercase tracking-wider">Suggestion</span>
                        </div>
                        <p className="text-xs text-indigo-200 leading-relaxed">{handoff.suggestions[0]}</p>
                      </div>
                    )}
                  </div>
                ))}
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
