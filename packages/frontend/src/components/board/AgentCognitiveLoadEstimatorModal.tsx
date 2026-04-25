import type { AgentCognitiveLoadEstimatorReport } from '../../api/mutations.js';

interface Props {
  result: AgentCognitiveLoadEstimatorReport | null;
  loading: boolean;
  onClose: () => void;
}

function ratingBadge(rating: string): string {
  switch (rating) {
    case 'critical': return 'bg-red-900/30 text-red-400 border-red-700/30';
    case 'high': return 'bg-orange-900/30 text-orange-400 border-orange-700/30';
    case 'moderate': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'low': return 'bg-green-900/30 text-green-400 border-green-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

function trendBadge(trend: string): string {
  switch (trend) {
    case 'increasing': return 'bg-red-900/30 text-red-400 border-red-700/30';
    case 'stable': return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
    case 'decreasing': return 'bg-green-900/30 text-green-400 border-green-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

export default function AgentCognitiveLoadEstimatorModal({ result, loading, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Agent Cognitive Load Estimator
            {result && (
              <span className="text-sm font-normal text-red-400/80 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                {result.metrics.length} agents
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Estimating cognitive load...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-gray-400 text-sm">No cognitive load data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Load</p>
                  <p className="text-red-200 text-xl font-bold">{result.fleetAvgCognitiveLoad}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Overloaded Agents</p>
                  <p className="text-red-200 text-xl font-bold">{result.overloadedAgents}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-gray-200 text-xl font-bold">{result.metrics.length}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Load Score</th>
                      <th className="px-4 py-3 text-center">Complexity</th>
                      <th className="px-4 py-3 text-center">Contexts</th>
                      <th className="px-4 py-3 text-center">Switch Rate</th>
                      <th className="px-4 py-3 text-center">Overloads</th>
                      <th className="px-4 py-3 text-center">Trend</th>
                      <th className="px-4 py-3 text-center">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.metrics.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.agentName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-red-500" style={{ width: `${m.cognitiveLoadScore}%` }} />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{m.cognitiveLoadScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.taskComplexityIndex.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.concurrentContextCount.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.contextSwitchRate.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.overloadEvents}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(m.trend)}`}>{m.trend}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${ratingBadge(m.rating)}`}>{m.rating}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

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
