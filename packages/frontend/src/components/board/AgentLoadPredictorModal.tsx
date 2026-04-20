import type { LoadPredictionReport, AgentLoadForecast } from '../../api/mutations.js';

interface AgentLoadPredictorModalProps {
  result: LoadPredictionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function riskBadgeClass(risk: AgentLoadForecast['riskLevel']): string {
  switch (risk) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-green-500/20 text-green-300 border-green-500/40';
  }
}

function utilizationBarColor(risk: AgentLoadForecast['riskLevel']): string {
  switch (risk) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'moderate': return 'bg-yellow-500';
    default: return 'bg-green-500';
  }
}

export default function AgentLoadPredictorModal({ result, isOpen, loading, onClose }: AgentLoadPredictorModalProps) {
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Agent Load Forecast
            {result && (
              <span className="text-sm font-normal text-amber-400/80 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full">
                {result.forecastWindow}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Predicting agent load...</span>
              </div>
            </div>
          ) : !result || result.agentForecasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-400 text-sm">No tickets found for load prediction.</p>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-full bg-gray-700/60 border border-gray-600/40 text-gray-300">
                  {result.totalTicketsPipeline} tickets in pipeline
                </span>
                <span className={`text-xs px-3 py-1 rounded-full border ${result.overloadedAgents > 0 ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-green-500/20 text-green-300 border-green-500/40'}`}>
                  {result.overloadedAgents} overloaded agent{result.overloadedAgents !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Agent forecast cards */}
              <div className="space-y-3">
                {result.agentForecasts.map((forecast) => {
                  const maxBar = Math.max(forecast.predictedLoad, 5);
                  const currentPct = Math.min((forecast.currentLoad / maxBar) * 100, 100);
                  const predictedPct = Math.min((forecast.predictedLoad / maxBar) * 100, 100);

                  return (
                    <div key={forecast.agentType} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-white font-semibold text-sm">{forecast.agentType}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${riskBadgeClass(forecast.riskLevel)}`}>
                            {forecast.riskLevel}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${riskBadgeClass(forecast.riskLevel)}`}>
                            {forecast.capacityUtilization.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Dual-segment bar */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Current: {forecast.currentLoad}</span>
                          <span className="text-gray-600">→</span>
                          <span>Predicted: {forecast.predictedLoad}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden relative">
                          <div
                            className="absolute left-0 top-0 h-full bg-gray-500 rounded-full"
                            style={{ width: `${currentPct}%` }}
                          />
                          <div
                            className={`absolute left-0 top-0 h-full rounded-full opacity-60 ${utilizationBarColor(forecast.riskLevel)}`}
                            style={{ width: `${predictedPct}%` }}
                          />
                        </div>
                        <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${utilizationBarColor(forecast.riskLevel)}`}
                            style={{ width: `${Math.min(forecast.capacityUtilization, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 italic">{forecast.recommendation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottleneck warnings */}
              {result.bottleneckWarnings.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 space-y-2">
                  <h3 className="text-red-300 font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Bottleneck Warnings
                  </h3>
                  <ul className="space-y-1">
                    {result.bottleneckWarnings.map((w, i) => (
                      <li key={i} className="text-xs text-red-200/80 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI insight */}
              <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-lg p-4 space-y-2">
                <h3 className="text-amber-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Insight
                </h3>
                <p className="text-amber-100/80 text-sm leading-relaxed">{result.aiInsight}</p>
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
