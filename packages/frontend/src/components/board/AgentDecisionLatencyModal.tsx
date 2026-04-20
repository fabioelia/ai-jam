import type { AgentDecisionLatencyReport, AgentDecisionLatencyMetrics } from '../../api/mutations.js';

interface Props {
  data: AgentDecisionLatencyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_BADGE: Record<AgentDecisionLatencyMetrics['latencyTier'], string> = {
  swift: 'bg-green-500/20 text-green-300 border-green-500/40',
  prompt: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  deliberate: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  sluggish: 'bg-red-500/20 text-red-300 border-red-500/40',
};

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export default function AgentDecisionLatencyModal({ data, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

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
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Agent Decision Latency Analyzer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && !data && (
            <p className="text-gray-400 text-center py-12">No data available.</p>
          )}

          {!loading && data && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{data.summary.totalAgents}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Agents</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-teal-400">{formatLatency(data.summary.avgDecisionLatency)}</div>
                  <div className="text-xs text-gray-400 mt-1">Avg Decision Latency</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-lg font-bold text-green-400 truncate">{data.summary.fastestAgent ?? '—'}</div>
                  <div className="text-xs text-gray-400 mt-1">Fastest Agent</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{data.summary.swiftAgentCount}</div>
                  <div className="text-xs text-gray-400 mt-1">Swift Agents</div>
                </div>
              </div>

              {/* Agent table */}
              {data.agents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-800">
                        <th className="text-left pb-3 pr-4">Agent</th>
                        <th className="text-left pb-3 pr-4">Tier</th>
                        <th className="text-left pb-3 pr-4 min-w-[120px]">Score</th>
                        <th className="text-right pb-3 pr-4">Avg Latency</th>
                        <th className="text-right pb-3 pr-4">Min</th>
                        <th className="text-right pb-3 pr-4">Max</th>
                        <th className="text-right pb-3">Tasks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.agents.map((agent) => (
                        <tr key={agent.agentId} className="text-gray-300">
                          <td className="py-3 pr-4 font-medium text-white">{agent.agentName}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_BADGE[agent.latencyTier]}`}>
                              {agent.latencyTier}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[80px]">
                                <div
                                  className="bg-teal-500 h-2 rounded-full"
                                  style={{ width: `${agent.latencyScore}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">{agent.latencyScore}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right">{formatLatency(agent.avgDecisionLatency)}</td>
                          <td className="py-3 pr-4 text-right text-green-400">{formatLatency(agent.minLatency)}</td>
                          <td className="py-3 pr-4 text-right text-red-400">{formatLatency(agent.maxLatency)}</td>
                          <td className="py-3 text-right">{agent.totalTasksAnalyzed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI Analysis */}
              <div className="rounded-lg p-4 bg-gradient-to-br from-teal-900/20 to-cyan-900/20 border border-teal-700/30">
                <h3 className="text-sm font-semibold text-teal-300 mb-2">AI Analysis</h3>
                <p className="text-sm text-gray-300 mb-3">{data.aiSummary}</p>
                {data.aiRecommendations.length > 0 && (
                  <ul className="space-y-1">
                    {data.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                        <span className="text-teal-400 mt-0.5">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
