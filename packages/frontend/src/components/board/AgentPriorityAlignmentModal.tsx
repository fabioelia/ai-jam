import type { PriorityAlignmentReport, AgentPriorityRecord } from '../../api/mutations.js';

interface AgentPriorityAlignmentModalProps {
  result: PriorityAlignmentReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function statusBadgeClass(status: AgentPriorityRecord['alignmentStatus']): string {
  switch (status) {
    case 'aligned': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'drifting': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'misaligned': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

export default function AgentPriorityAlignmentModal({ result, isOpen, loading, onClose }: AgentPriorityAlignmentModalProps) {
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
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            AI Agent Priority Alignment
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {result.totalActiveTickets} active ticket{result.totalActiveTickets !== 1 ? 's' : ''}
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
                <span className="text-sm">Checking priority alignment...</span>
              </div>
            </div>
          ) : !result || result.agentRecords.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No in-progress tickets found for priority alignment analysis.</p>
            </div>
          ) : (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Agents', value: result.totalAgentsAnalyzed, color: 'text-white' },
                  { label: 'Aligned', value: result.alignedAgents, color: 'text-green-300' },
                  { label: 'Drifting', value: result.driftingAgents, color: 'text-yellow-300' },
                  { label: 'Misaligned', value: result.misalignedAgents, color: 'text-red-300' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Agent Cards */}
              <div className="space-y-3">
                {result.agentRecords.map((record) => (
                  <div
                    key={record.agentPersona}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">{record.agentPersona}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{Math.round(record.alignmentScore * 100)}%</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${statusBadgeClass(record.alignmentStatus)}`}>
                          {record.alignmentStatus}
                        </span>
                      </div>
                    </div>

                    {/* Priority breakdown */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'Critical', count: record.criticalCount, color: 'text-red-300' },
                        { label: 'High', count: record.highCount, color: 'text-orange-300' },
                        { label: 'Medium', count: record.mediumCount, color: 'text-yellow-300' },
                        { label: 'Low', count: record.lowCount, color: 'text-gray-300' },
                      ].map(({ label, count, color }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className={`text-sm font-semibold ${count > 0 ? color : 'text-gray-600'}`}>{count}</p>
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    <p className="text-xs text-gray-400 leading-relaxed">{record.explanation}</p>
                  </div>
                ))}
              </div>

              {/* AI Recommendation */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-amber-300 uppercase tracking-wider">AI Recommendation</span>
                </div>
                <p className="text-sm text-amber-100 leading-relaxed">{result.aiRecommendation}</p>
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
