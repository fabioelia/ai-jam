import type { AgentDecisionConfidenceReport } from '../../api/mutations.js';

interface Props {
  result: AgentDecisionConfidenceReport | null;
  loading: boolean;
  onClose: () => void;
}

function levelBadge(level: string): string {
  switch (level) {
    case 'well-calibrated': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'overconfident': return 'bg-red-900/30 text-red-400 border-red-700/30';
    case 'underconfident': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    default: return 'bg-orange-900/30 text-orange-400 border-orange-700/30';
  }
}

function trendBadge(trend: string): string {
  switch (trend) {
    case 'rising': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'declining': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

export default function AgentDecisionConfidenceAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Decision Confidence Analyzer
            {result && (
              <span className="text-sm font-normal text-stone-400/80 border border-stone-500/30 bg-stone-500/10 px-2 py-0.5 rounded-full">
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
                Analyzing decision confidence...
              </div>
            </div>
          ) : result ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-stone-400">{result.fleetAvgConfidenceScore}%</div>
                  <div className="text-xs text-gray-400 mt-1">Fleet Avg Confidence</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{result.overconfidentAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Overconfident Agents</div>
                  <div className="text-xs text-gray-500 mt-0.5">calibration &lt; 40</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{result.wellCalibratedAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Well-Calibrated Agents</div>
                  <div className="text-xs text-gray-500 mt-0.5">calibration ≥ 75</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-white font-medium text-sm">Agent Confidence Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Agent</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Avg Confidence</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">High Conf Rate</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Low Conf Rate</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Overconf Failures</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Calibration</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Trend</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="px-4 py-2 text-white">{m.agentName}</td>
                          <td className="px-4 py-2 text-right text-stone-400 font-semibold">{m.avgConfidenceScore}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.highConfidenceRate}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.lowConfidenceRate}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.overconfidentFailures}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.calibrationScore}%</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${trendBadge(m.confidenceTrend)}`}>
                              {m.confidenceTrend}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${levelBadge(m.confidenceLevel)}`}>
                              {m.confidenceLevel.replace('-', ' ')}
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
