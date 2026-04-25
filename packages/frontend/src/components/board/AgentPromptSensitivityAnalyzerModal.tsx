import type { AgentPromptSensitivityReport } from '../../api/mutations.js';

interface Props {
  result: AgentPromptSensitivityReport | null;
  loading: boolean;
  onClose: () => void;
}

function levelBadge(level: string): string {
  switch (level) {
    case 'robust': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'moderate': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'sensitive': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
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

export default function AgentPromptSensitivityAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Prompt Sensitivity
            {result && (
              <span className="text-sm font-normal text-sky-400/80 border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 rounded-full">
                {result.agents.length} agents
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
                Analyzing prompt sensitivity...
              </div>
            </div>
          ) : result ? (
            <>
              {/* Score Gauges */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{result.sensitivityScore}%</div>
                  <div className="text-xs text-gray-400 mt-1">Sensitivity Score</div>
                  <div className="text-xs text-gray-500 mt-0.5">(lower is better)</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-sky-400">{result.robustnessScore}</div>
                  <div className="text-xs text-gray-400 mt-1">Robustness Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-400">{result.highVarianceRate}%</div>
                  <div className="text-xs text-gray-400 mt-1">High Variance Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">{result.ambiguityFailureRate}%</div>
                  <div className="text-xs text-gray-400 mt-1">Ambiguity Failure Rate</div>
                </div>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Most Robust Agent</div>
                  <div className="text-white font-medium">{result.mostRobustAgent}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Most Sensitive Agent</div>
                  <div className="text-white font-medium">{result.mostSensitiveAgent}</div>
                </div>
              </div>

              {/* Agent table */}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-white font-medium text-sm">Agent Ranking</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-gray-400 font-medium">Agent</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Responses</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">High Variance</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Ambiguity Fails</th>
                        <th className="px-4 py-2 text-right text-gray-400 font-medium">Robust</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Sensitivity</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Level</th>
                        <th className="px-4 py-2 text-center text-gray-400 font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.agents.map((agent) => (
                        <tr key={agent.agentId} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="px-4 py-2 text-white">{agent.agentName}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{agent.totalResponses}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{agent.highVarianceResponses}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{agent.ambiguityFailures}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{agent.robustResponses}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="text-sky-400 font-semibold">{agent.sensitivityScore}%</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs capitalize ${levelBadge(agent.sensitivityLevel)}`}>
                              {agent.sensitivityLevel.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded border text-xs ${trendBadge(agent.trend)}`}>
                              {agent.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Summary */}
              {result.aiSummary && (
                <div className="bg-sky-900/10 border border-sky-700/20 rounded-lg p-4">
                  <div className="text-xs text-sky-400 font-medium mb-2 uppercase tracking-wide">AI Summary</div>
                  <p className="text-gray-300 text-sm">{result.aiSummary}</p>
                </div>
              )}

              {/* Recommendations */}
              {result.aiRecommendations && result.aiRecommendations.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wide">Recommendations</div>
                  <ul className="space-y-2">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-sky-400 mt-0.5">•</span>
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
