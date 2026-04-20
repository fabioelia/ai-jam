import type { FocusAdvisorReport, AgentFocusAdvice } from '../../api/mutations.js';

interface AgentFocusAdvisorModalProps {
  result: FocusAdvisorReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function riskBadge(risk: AgentFocusAdvice['focusRisk']): { label: string; className: string } {
  switch (risk) {
    case 'overloaded':
      return { label: 'Overloaded', className: 'bg-red-500/20 text-red-300 border-red-500/40' };
    case 'stale':
      return { label: 'Stale', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    case 'idle':
      return { label: 'Idle', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    case 'balanced':
      return { label: 'Balanced', className: 'bg-green-500/20 text-green-300 border-green-500/40' };
  }
}

export default function AgentFocusAdvisorModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentFocusAdvisorModalProps) {
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
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Focus Advisor
            </h2>
            {result && (
              <p className="text-xs text-gray-400 mt-0.5">
                {result.totalAgents} agents · {result.overloadedAgents} overloaded · {result.idleAgents} idle · {result.staleAgents} stale
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
                <span className="text-sm">Analyzing agent focus...</span>
              </div>
            </div>
          ) : !result || result.agentAdvice.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No active agents found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.agentAdvice.map((agent) => {
                const badge = riskBadge(agent.focusRisk);
                const staleTitle = agent.topStaleTicket?.title
                  ? agent.topStaleTicket.title.length > 40
                    ? agent.topStaleTicket.title.slice(0, 40) + '…'
                    : agent.topStaleTicket.title
                  : null;
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
                      <span>In Progress: {agent.inProgressCount} tickets</span>
                      <span>Stale: {agent.staleCount} tickets</span>
                    </div>

                    {staleTitle && (
                      <p className="text-xs text-gray-500 truncate">{staleTitle}</p>
                    )}

                    {agent.focusRisk !== 'balanced' && agent.recommendation && (
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
