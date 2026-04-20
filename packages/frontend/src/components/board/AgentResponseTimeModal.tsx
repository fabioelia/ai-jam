import type { ResponseTimeReport, AgentResponseProfile } from '../../api/mutations.js';

interface AgentResponseTimeModalProps {
  result: ResponseTimeReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function msToHours(ms: number): string {
  return (ms / 3_600_000).toFixed(1) + 'h';
}

function categoryBadge(category: AgentResponseProfile['responseCategory']): { label: string; className: string } {
  switch (category) {
    case 'fast':
      return { label: 'Fast', className: 'bg-green-500/20 text-green-300 border-green-500/40' };
    case 'normal':
      return { label: 'Normal', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' };
    case 'slow':
      return { label: 'Slow', className: 'bg-red-500/20 text-red-300 border-red-500/40' };
  }
}

export default function AgentResponseTimeModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentResponseTimeModalProps) {
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
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Response Time Profiler
            </h2>
            {result && (
              <p className="text-xs text-gray-400 mt-0.5">
                {result.totalAgents} agents · {result.slowAgents} slow · avg {msToHours(result.avgProjectResponseMs)} project response
              </p>
            )}
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
                <span className="text-sm">Profiling agent response times...</span>
              </div>
            </div>
          ) : !result || result.agentProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No acted-on tickets found for response time analysis.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.agentProfiles.map((agent) => {
                const badge = categoryBadge(agent.responseCategory);
                return (
                  <div
                    key={agent.agentName}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-white font-semibold text-sm">{agent.agentName}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      <span>Avg: {msToHours(agent.avgResponseTimeMs)}</span>
                      <span>Fastest: {msToHours(agent.minResponseTimeMs)}</span>
                      <span>Slowest: {msToHours(agent.maxResponseTimeMs)}</span>
                    </div>

                    <div className="text-xs text-gray-500">
                      Acting on: {agent.ticketsActedOn} tickets · Unstarted: {agent.unstartedTickets}
                    </div>

                    {agent.responseCategory === 'slow' && agent.recommendation && (
                      <p className="text-xs text-gray-400 italic">{agent.recommendation}</p>
                    )}
                  </div>
                );
              })}
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
