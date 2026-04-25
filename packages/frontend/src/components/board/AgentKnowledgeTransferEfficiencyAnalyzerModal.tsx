import type { AgentKnowledgeTransferEfficiencyReport } from '../../api/mutations.js';

interface Props {
  result: AgentKnowledgeTransferEfficiencyReport | null;
  loading: boolean;
  onClose: () => void;
}

function qualityBadge(quality: string): string {
  switch (quality) {
    case 'excellent': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'good': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'poor': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    default: return 'bg-red-900/30 text-red-400 border-red-700/30';
  }
}

function trendBadge(trend: string): string {
  switch (trend) {
    case 'improving': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'degrading': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

export default function AgentKnowledgeTransferEfficiencyAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Knowledge Transfer Efficiency Analyzer
            {result && (
              <span className="text-sm font-normal text-zinc-400/80 border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 rounded-full">
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
                Analyzing knowledge transfer efficiency...
              </div>
            </div>
          ) : result ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-zinc-400">{result.fleetAvgTransferScore}%</div>
                  <div className="text-xs text-gray-400 mt-1">Fleet Avg Transfer Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{result.highLossAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">High-Loss Agents</div>
                  <div className="text-xs text-gray-500 mt-0.5">loss events &gt; 3</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{result.excellentTransferAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Excellent Transfer Agents</div>
                  <div className="text-xs text-gray-500 mt-0.5">score ≥ 85</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-white font-medium text-sm">Agent Knowledge Transfer Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Agent</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Transfer Score</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Retention Rate</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Loss Events</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Initiated</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Received</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Latency (ms)</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Trend</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="px-4 py-2 text-white">{m.agentName}</td>
                          <td className="px-4 py-2 text-right text-zinc-400 font-semibold">{m.transferEfficiencyScore}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.avgContextRetentionRate}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.knowledgeLossEvents}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.handoffsInitiated}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.handoffsReceived}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.transferLatency}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${trendBadge(m.transferTrend)}`}>
                              {m.transferTrend}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${qualityBadge(m.transferQuality)}`}>
                              {m.transferQuality}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">No data yet. Run the analysis.</div>
          )}
        </div>
      </div>
    </div>
  );
}
