import type { VelocityForecastReport, AgentVelocity } from '../../api/mutations.js';

interface AgentVelocityForecastModalProps {
  result: VelocityForecastReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: AgentVelocity['trend']): { label: string; icon: string; className: string } {
  switch (trend) {
    case 'up':
      return { label: 'Up', icon: '↑', className: 'bg-green-500/20 text-green-300 border-green-500/40' };
    case 'down':
      return { label: 'Down', icon: '↓', className: 'bg-red-500/20 text-red-300 border-red-500/40' };
    case 'stable':
      return { label: 'Stable', icon: '→', className: 'bg-gray-500/20 text-gray-300 border-gray-500/40' };
    case 'new':
      return { label: 'New', icon: '★', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
  }
}

export default function AgentVelocityForecastModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentVelocityForecastModalProps) {
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
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Velocity Forecast
            </h2>
            {result && (
              <p className="text-xs text-gray-400 mt-0.5">
                {result.totalAgents} agents · {result.totalForecastPoints} pts forecast · Top:{' '}
                {result.topAgent ?? 'N/A'}
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
                <span className="text-sm">Forecasting velocity...</span>
              </div>
            </div>
          ) : !result || result.agentVelocities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-400 text-sm">No completed tickets to analyze.</p>
            </div>
          ) : (
            <>
              {/* At-risk banner */}
              {result.atRiskAgents.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {result.atRiskAgents.length} agent(s) trending down
                </div>
              )}

              {/* Agent rows */}
              <div className="space-y-3">
                {result.agentVelocities.map((agent) => {
                  const badge = trendBadge(agent.trend);
                  return (
                    <div
                      key={agent.agentName}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}
                        >
                          {badge.icon} {badge.label}
                        </span>
                        <span className="text-white font-semibold text-sm">{agent.agentName}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                        <span>Recent: {agent.recentPoints} pts ({agent.recentCount} tickets)</span>
                        <span>Prior: {agent.priorPoints} pts ({agent.priorCount} tickets)</span>
                        <span className="font-bold text-white">Forecast: {agent.forecastPoints} pts</span>
                      </div>

                      {(agent.trend === 'up' || agent.trend === 'down') && (
                        <p className="text-xs text-gray-500 italic">{agent.recommendation}</p>
                      )}
                    </div>
                  );
                })}
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
