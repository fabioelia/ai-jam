import type { SprintCommitmentReport, AgentCommitmentRecord } from '../../api/mutations.js';

interface AgentSprintCommitmentModalProps {
  result: SprintCommitmentReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function statusStyle(status: AgentCommitmentRecord['status']): { bar: string; badge: string; label: string } {
  switch (status) {
    case 'overcommitted':
      return { bar: 'bg-red-500', badge: 'bg-red-500/20 text-red-300 border-red-500/40', label: 'Overcommitted' };
    case 'underutilized':
      return { bar: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', label: 'Underutilized' };
    default:
      return { bar: 'bg-green-500', badge: 'bg-green-500/20 text-green-300 border-green-500/40', label: 'On Track' };
  }
}

export default function AgentSprintCommitmentModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentSprintCommitmentModalProps) {
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
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Sprint Commitment Tracker
            </h2>
            <span className="text-xs text-teal-400/70 mt-0.5 inline-block">Last 14 days</span>
          </div>
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
                <span className="text-sm">Analyzing sprint commitments...</span>
              </div>
            </div>
          ) : !result || result.agentRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-sm">No tickets found for sprint commitment analysis.</p>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Planned</p>
                  <p className="text-white font-bold text-xl">{result.totalPlanned}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Completed</p>
                  <p className="text-white font-bold text-xl">{result.totalCompleted}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Overall Ratio</p>
                  <p className={`font-bold text-xl ${result.overallCommitmentRatio < 0.6 ? 'text-red-400' : result.overallCommitmentRatio > 1.2 ? 'text-blue-400' : 'text-green-400'}`}>
                    {(result.overallCommitmentRatio * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="flex gap-3 flex-wrap">
                {result.overcommittedAgents > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    {result.overcommittedAgents} overcommitted
                  </span>
                )}
                {result.onTrackAgents > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
                    {result.onTrackAgents} on-track
                  </span>
                )}
                {result.underutilizedAgents > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    {result.underutilizedAgents} underutilized
                  </span>
                )}
              </div>

              {/* Agent cards */}
              <div className="space-y-3">
                {result.agentRecords.map((agent) => {
                  const style = statusStyle(agent.status);
                  const barWidth = Math.min(agent.commitmentRatio * 100, 200);
                  return (
                    <div key={agent.agentType} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-white font-semibold text-sm">{agent.agentType}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${style.badge}`}>
                          {style.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Planned: {agent.plannedTickets}</span>
                        <span>Completed: {agent.completedTickets}</span>
                        <span className="font-bold text-white">{(agent.commitmentRatio * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${style.bar}`}
                          style={{ width: `${Math.min(barWidth, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 italic">{agent.statusExplanation}</p>
                    </div>
                  );
                })}
              </div>

              {/* AI recommendation */}
              <div className="rounded-lg bg-gradient-to-br from-teal-900/30 to-teal-800/10 border border-teal-700/40 p-4">
                <p className="text-xs font-semibold text-teal-300 mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Recommendation
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">{result.aiRecommendation}</p>
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
