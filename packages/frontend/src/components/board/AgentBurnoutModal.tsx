import type { BurnoutReport, AgentBurnoutStatus } from '../../api/mutations.js';

interface AgentBurnoutModalProps {
  result: BurnoutReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function riskBadgeClass(level: AgentBurnoutStatus['riskLevel']): string {
  switch (level) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  }
}

export default function AgentBurnoutModal({ result, isOpen, loading, onClose }: AgentBurnoutModalProps) {
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
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Agent Health
            {result && (
              <div className="flex items-center gap-2">
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
              </div>
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
                <span className="text-sm">Analyzing agent health...</span>
              </div>
            </div>
          ) : !result || result.atRiskAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">All agents operating within healthy limits.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.atRiskAgents.map((agent) => (
                <div
                  key={agent.agentName}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2"
                >
                  {/* Name + Risk + Chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${riskBadgeClass(agent.riskLevel)}`}>
                      {agent.riskLevel}
                    </span>
                    <span className="text-white font-semibold text-sm">{agent.agentName}</span>
                    {agent.overloaded && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">
                        Overloaded
                      </span>
                    )}
                    {agent.degrading && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/30">
                        Degrading
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <p className="text-xs text-gray-400">
                    {agent.activeCount} active tickets · {agent.avgStaleDays}d avg stale · {agent.storyPointLoad} SP
                  </p>

                  {/* Recommendation */}
                  <p className="text-xs text-gray-500 italic">{agent.recommendation}</p>
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
