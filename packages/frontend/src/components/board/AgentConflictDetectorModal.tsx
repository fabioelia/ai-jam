import type { DomainConflict, ConflictReport, ConflictSeverity } from '../../api/mutations.js';

interface AgentConflictDetectorModalProps {
  result: ConflictReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function severityBadgeClass(severity: ConflictSeverity): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function typeBadgeClass(domainType: 'label' | 'epic'): string {
  return domainType === 'label'
    ? 'bg-gray-500/20 text-gray-300 border-gray-500/40'
    : 'bg-blue-500/20 text-blue-300 border-blue-500/40';
}

function ConflictRow({ conflict }: { conflict: DomainConflict }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-white">{conflict.domain}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${typeBadgeClass(conflict.domainType)}`}>
          {conflict.domainType === 'label' ? 'Label' : 'Epic'}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${severityBadgeClass(conflict.severity)}`}>
          {conflict.severity}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        Score: {conflict.conflictScore}% · Active: {conflict.activeTickets}/{conflict.totalTickets} tickets
      </p>
      <div className="flex flex-wrap gap-1">
        {conflict.agents.map((agent) => (
          <span
            key={agent}
            className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40"
          >
            {agent}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-300 italic">{conflict.recommendation}</p>
    </div>
  );
}

export default function AgentConflictDetectorModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentConflictDetectorModalProps) {
  if (!isOpen) return null;

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
            <svg
              className="w-5 h-5 text-orange-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Agent Conflict Detector
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                {result.totalConflicts} conflicts · {result.criticalConflicts} critical · {result.cleanDomains} clean domains
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">Scanning for assignment conflicts...</span>
              </div>
            </div>
          ) : !result ? null : (
            <>
              {/* AI Summary */}
              {result.aiSummary && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>
                </div>
              )}

              {/* Critical warning bar */}
              {result.criticalConflicts > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-2">
                  <svg
                    className="w-4 h-4 text-red-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-sm text-red-300 font-medium">
                    ⚠ {result.criticalConflicts} critical ownership conflict{result.criticalConflicts !== 1 ? 's' : ''} require immediate resolution
                  </span>
                </div>
              )}

              {/* Conflict rows */}
              {result.domainConflicts.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-400 text-sm italic">
                    No domain conflicts detected — clean agent ownership boundaries.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.domainConflicts.map((conflict, i) => (
                    <ConflictRow key={`${conflict.domain}-${conflict.domainType}-${i}`} conflict={conflict} />
                  ))}
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
