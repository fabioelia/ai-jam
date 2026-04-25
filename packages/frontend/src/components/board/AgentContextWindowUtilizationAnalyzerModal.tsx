import type { AgentContextWindowUtilizationReport } from '../../api/mutations.js';

interface Props {
  result: AgentContextWindowUtilizationReport | null;
  loading: boolean;
  onClose: () => void;
}

function levelBadge(level: string): string {
  switch (level) {
    case 'efficient': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'moderate': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'high': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    default: return 'bg-red-900/30 text-red-400 border-red-700/30';
  }
}

function trendBadge(trend: string): string {
  switch (trend) {
    case 'decreasing': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'increasing': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

export default function AgentContextWindowUtilizationAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h7" />
            </svg>
            Context Window Utilization
            {result && (
              <span className="text-sm font-normal text-yellow-400/80 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-full">
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing context window utilization...
              </div>
            </div>
          ) : result ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">{result.fleetAvgUtilizationPct}%</div>
                  <div className="text-xs text-gray-400 mt-1">Fleet Avg Utilization</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{result.criticalUtilizationAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Critical Agents</div>
                  <div className="text-xs text-gray-500 mt-0.5">≥ 85% utilization</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{result.efficientAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Efficient Agents</div>
                  <div className="text-xs text-gray-500 mt-0.5">&lt; 40% utilization</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-300">{result.metrics.length}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Agents</div>
                </div>
              </div>

              {result.utilizationDistribution.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {result.utilizationDistribution.map((d) => (
                    <div key={d.bucket} className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-yellow-400">{d.count}</div>
                      <div className="text-xs text-gray-400 mt-1">{d.bucket}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-white font-medium text-sm">Agent Context Window Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Agent</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Avg Util %</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Peak %</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Truncations</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Refresh Rate</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">High Util Sessions</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Trend</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="px-4 py-2 text-white">{m.agentName}</td>
                          <td className="px-4 py-2 text-right text-yellow-400 font-semibold">{m.avgUtilizationPct}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.peakUtilizationPct}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.truncationEvents}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.contextRefreshRate}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.highUtilizationSessions}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${trendBadge(m.utilizationTrend)}`}>
                              {m.utilizationTrend}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${levelBadge(m.utilizationLevel)}`}>
                              {m.utilizationLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.criticalSessions.length > 0 && (
                <div className="bg-red-900/10 border border-red-700/20 rounded-lg p-4">
                  <div className="text-xs text-red-400 font-medium mb-3 uppercase tracking-wide">Critical Sessions (Peak ≥ 90%)</div>
                  <ul className="space-y-1">
                    {result.criticalSessions.map((s, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{s.agentName}</span>
                        <span className="text-red-400 font-semibold">{s.utilizationPct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="bg-yellow-900/10 border border-yellow-700/20 rounded-lg p-4">
                  <div className="text-xs text-yellow-400 font-medium mb-3 uppercase tracking-wide">Recommendations</div>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">No data yet. Run the analysis.</div>
          )}
        </div>
      </div>
    </div>
  );
}
