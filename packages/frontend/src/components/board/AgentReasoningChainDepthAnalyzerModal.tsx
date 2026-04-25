import type { AgentReasoningChainDepthReport } from '../../api/mutations.js';

interface Props {
  result: AgentReasoningChainDepthReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string): string {
  switch (trend) {
    case 'increasing': return 'bg-red-900/30 text-red-400 border-red-700/30';
    case 'stable': return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
    case 'decreasing': return 'bg-green-900/30 text-green-400 border-green-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

function ratingBadge(rating: string): string {
  switch (rating) {
    case 'optimal': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'adequate': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'shallow': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'excessive': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

export default function AgentReasoningChainDepthAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reasoning Chain Depth
            {result && (
              <span className="text-sm font-normal text-slate-400/80 border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing reasoning chain depth...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-400 text-sm">No reasoning chain depth data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/20 border border-slate-500/30 rounded-lg px-4 py-3">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Chain Depth</p>
                  <p className="text-slate-200 text-2xl font-bold">{result.fleetAvgChainDepth}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Optimal Agents</p>
                  <p className="text-green-200 text-xl font-bold">{result.optimalAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Avg Depth</th>
                      <th className="px-4 py-3 text-center">Max</th>
                      <th className="px-4 py-3 text-center">Min</th>
                      <th className="px-4 py-3 text-center">Optimal %</th>
                      <th className="px-4 py-3 text-center">Over %</th>
                      <th className="px-4 py-3 text-center">Under %</th>
                      <th className="px-4 py-3 text-center">Trend</th>
                      <th className="px-4 py-3 text-center">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.metrics.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.agentName}</td>
                        <td className="px-4 py-3 text-center text-slate-200 font-mono">{m.avgChainDepth}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.maxChainDepth}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.minChainDepth}</td>
                        <td className="px-4 py-3 text-center text-green-400">{m.optimalRangeRate}%</td>
                        <td className="px-4 py-3 text-center text-red-400">{m.overReasoningRate}%</td>
                        <td className="px-4 py-3 text-center text-yellow-400">{m.underReasoningRate}%</td>
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
