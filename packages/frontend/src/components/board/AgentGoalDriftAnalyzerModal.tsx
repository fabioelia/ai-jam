import type { AgentGoalDriftReport, AgentGoalDriftMetric } from '../../api/mutations.js';

interface Props {
  result: AgentGoalDriftReport | null;
  loading: boolean;
  onClose: () => void;
}

function severityBadge(severity: AgentGoalDriftMetric['severity']): string {
  switch (severity) {
    case 'low': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'medium': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'high': return 'bg-orange-900/30 text-orange-400 border-orange-700/30';
    case 'critical': return 'bg-red-900/30 text-red-400 border-red-700/30';
  }
}

function trendIcon(trend: AgentGoalDriftMetric['trend']): string {
  switch (trend) {
    case 'improving': return '↑';
    case 'worsening': return '↓';
    default: return '→';
  }
}

export default function AgentGoalDriftAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Agent Goal Drift Analyzer
            {result && (
              <span className="text-sm font-normal text-orange-400/80 border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing goal drift...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No goal drift data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Drift Score</p>
                  <p className="text-orange-200 text-xl font-bold">{result.fleetAvgDriftScore}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">High Drift Agents</p>
                  <p className="text-red-200 text-xl font-bold">{result.highDriftAgents}</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-gray-200 text-xl font-bold">{result.metrics.length}</p>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-700/50">
                  <h3 className="text-gray-300 text-sm font-medium">Per-Agent Goal Drift Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Agent</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Drift Score</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">On-Task Ratio</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Drift Events</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Avg Duration (s)</th>
                        <th className="text-center px-4 py-2 text-gray-400 font-medium">Trend</th>
                        <th className="text-center px-4 py-2 text-gray-400 font-medium">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-white font-medium">{m.agentName}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${m.driftScore}%` }} />
                              </div>
                              <span className="text-orange-300 font-medium w-8 text-right">{m.driftScore}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.onTaskRatio}%</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.driftEvents}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.avgDriftDurationSeconds}s</td>
                          <td className="px-4 py-2 text-center text-gray-400">{trendIcon(m.trend)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityBadge(m.severity)}`}>
                              {m.severity}
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
