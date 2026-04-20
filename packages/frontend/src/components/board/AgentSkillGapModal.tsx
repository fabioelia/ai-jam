import type { SkillGapEntry, SkillGapReport, GapSeverity } from '../../api/mutations.js';

interface AgentSkillGapModalProps {
  result: SkillGapReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function severityBadgeClass(severity: GapSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SkillGapRow({ entry }: { entry: SkillGapEntry }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-white">{entry.label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityBadgeClass(entry.gapSeverity)}`}>
          {capitalise(entry.gapSeverity)}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        Tickets: {entry.totalTickets} · Done: {entry.completedTickets} · Stalled: {entry.stalledTickets} · Rate: {Math.round(entry.completionRate * 100)}%
      </p>
      <div className="flex flex-wrap gap-1">
        {entry.coveredByAgents.length === 0 ? (
          <span className="text-xs text-gray-500 italic">No agents</span>
        ) : (
          entry.coveredByAgents.map((agent) => (
            <span key={agent} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {agent}
            </span>
          ))
        )}
      </div>
      <p className="text-xs text-gray-300 italic">{entry.recommendation}</p>
    </div>
  );
}

export default function AgentSkillGapModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentSkillGapModalProps) {
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
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Agent Skill Gap Analysis
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {result.totalLabels} labels · {result.criticalGaps} critical gaps · {result.coveredLabels} well-covered
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
                <span className="text-sm">Analyzing skill gaps...</span>
              </div>
            </div>
          ) : !result || result.skillGaps.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No skill gaps detected — great team coverage!</p>
            </div>
          ) : (
            <>
              {/* AI Summary */}
              <div className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-rose-300 uppercase tracking-wider">AI Summary</span>
                </div>
                <p className="text-sm text-rose-100 leading-relaxed italic">{result.aiSummary}</p>
              </div>

              {/* Critical warning */}
              {result.criticalGaps > 0 && (
                <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 flex items-center gap-2">
                  <span className="text-red-400 text-sm font-medium">⚠ {result.criticalGaps} critical skill gap(s) require immediate attention</span>
                </div>
              )}

              {/* Gap rows */}
              <div className="space-y-3">
                {result.skillGaps.map((entry) => (
                  <SkillGapRow key={entry.label} entry={entry} />
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
