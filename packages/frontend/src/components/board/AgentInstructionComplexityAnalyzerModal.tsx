import type { AgentInstructionComplexityReport } from '../../api/mutations.js';

interface Props {
  result: AgentInstructionComplexityReport | null;
  loading: boolean;
  onClose: () => void;
}

function levelBadge(level: string): string {
  switch (level) {
    case 'simple': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'moderate': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'complex': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
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

export default function AgentInstructionComplexityAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Instruction Complexity
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing instruction complexity...
              </div>
            </div>
          ) : result ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-slate-400">{result.fleetAvgComplexityScore}</div>
                  <div className="text-xs text-gray-400 mt-1">Fleet Avg Complexity</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{result.criticalComplexityAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Critical Complexity</div>
                  <div className="text-xs text-gray-500 mt-0.5">score ≥ 75</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">{result.simpleInstructionAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Simple Instructions</div>
                  <div className="text-xs text-gray-500 mt-0.5">score &lt; 25</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-slate-300">{result.metrics.length}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Agents</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-white font-medium text-sm">Agent Instruction Complexity Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Agent</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Complexity</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Avg Length</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Ambiguity</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Branches</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Depth</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Trend</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="px-4 py-2 text-white">{m.agentName}</td>
                          <td className="px-4 py-2 text-right text-slate-400 font-semibold">{m.complexityScore}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.avgInstructionLength}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.ambiguityScore}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.conditionalBranchCount}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.multiStepDepth}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${trendBadge(m.complexityTrend)}`}>
                              {m.complexityTrend}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${levelBadge(m.complexityLevel)}`}>
                              {m.complexityLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.topComplexInstructions.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wide">Top Complex Instruction Patterns</div>
                  <ul className="space-y-2">
                    {result.topComplexInstructions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-slate-400 mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="bg-slate-900/20 border border-slate-700/20 rounded-lg p-4">
                  <div className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wide">Recommendations</div>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-slate-400 mt-0.5">•</span>
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
