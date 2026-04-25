import type { AgentDecisionLatencyAnalyzerReport, AgentDecisionLatencyAnalyzerMetric } from '../../api/mutations.js';

interface Props {
  result: AgentDecisionLatencyAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function ratingBadge(rating: AgentDecisionLatencyAnalyzerMetric['rating']): string {
  switch (rating) {
    case 'fast': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'acceptable': return 'bg-cyan-900/30 text-cyan-400 border-cyan-700/30';
    case 'slow': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'critical': return 'bg-red-900/30 text-red-400 border-red-700/30';
  }
}

function trendIcon(trend: AgentDecisionLatencyAnalyzerMetric['trend']): string {
  switch (trend) {
    case 'improving': return '↑';
    case 'worsening': return '↓';
    default: return '→';
  }
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AgentDecisionLatencyAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Agent Decision Latency Analyzer
            {result && (
              <span className="text-sm font-normal text-cyan-400/80 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing decision latency...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No decision latency data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Latency</p>
                  <p className="text-cyan-200 text-xl font-bold">{fmtMs(result.fleetAvgLatencyMs)}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Slow Agents</p>
                  <p className="text-red-200 text-xl font-bold">{result.slowAgents}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-gray-200 text-xl font-bold">{result.metrics.length}</p>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-700/50">
                  <h3 className="text-gray-300 text-sm font-medium">Per-Agent Decision Latency</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Agent</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Avg Latency</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">P50</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">P95</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Slow</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Fast</th>
                        <th className="text-center px-4 py-2 text-gray-400 font-medium">Trend</th>
                        <th className="text-center px-4 py-2 text-gray-400 font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-white font-medium">{m.agentName}</td>
                          <td className="px-4 py-2 text-right text-cyan-300 font-medium">{fmtMs(m.avgDecisionLatencyMs)}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{fmtMs(m.p50LatencyMs)}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{fmtMs(m.p95LatencyMs)}</td>
                          <td className="px-4 py-2 text-right text-red-400">{m.slowDecisions}</td>
                          <td className="px-4 py-2 text-right text-green-400">{m.fastDecisions}</td>
                          <td className="px-4 py-2 text-center text-gray-400">{trendIcon(m.trend)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ratingBadge(m.rating)}`}>
                              {m.rating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
