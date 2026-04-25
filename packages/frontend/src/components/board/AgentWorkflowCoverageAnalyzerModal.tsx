import type { AgentWorkflowCoverageReport, AgentWorkflowCoverageMetric } from '../../api/mutations.js';

interface Props {
  result: AgentWorkflowCoverageReport | null;
  loading: boolean;
  onClose: () => void;
}

function levelBadge(level: AgentWorkflowCoverageMetric['coverageLevel']): string {
  switch (level) {
    case 'full': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'high': return 'bg-blue-900/30 text-blue-400 border-blue-700/30';
    case 'partial': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'low': return 'bg-red-900/30 text-red-400 border-red-700/30';
  }
}

function trendBadge(trend: AgentWorkflowCoverageMetric['coverageTrend']): string {
  switch (trend) {
    case 'expanding': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'shrinking': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

export default function AgentWorkflowCoverageAnalyzerModal({ result, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Agent Workflow Coverage Analyzer
            {result && (
              <span className="text-sm font-normal text-rose-400/80 border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing workflow coverage...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No workflow coverage data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-rose-900/20 border border-rose-500/30 rounded-lg px-4 py-3">
                  <p className="text-rose-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Coverage Score</p>
                  <p className="text-rose-200 text-xl font-bold">{result.fleetAvgCoverageScore}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Low Coverage Agents</p>
                  <p className="text-red-200 text-xl font-bold">{result.lowCoverageAgents}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Full Coverage Agents</p>
                  <p className="text-green-200 text-xl font-bold">{result.fullCoverageAgents}</p>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-700/50">
                  <h3 className="text-gray-300 text-sm font-medium">Per-Agent Workflow Coverage</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700/50">
                        <th className="text-left px-4 py-2 text-gray-400 font-medium">Agent</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Coverage %</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Autonomous</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Assisted</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Blocked</th>
                        <th className="text-right px-4 py-2 text-gray-400 font-medium">Total Steps</th>
                        <th className="text-center px-4 py-2 text-gray-400 font-medium">Trend</th>
                        <th className="text-center px-4 py-2 text-gray-400 font-medium">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.metrics.map((m) => (
                        <tr key={m.agentId} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                          <td className="px-4 py-2 text-white font-medium">{m.agentName}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${m.coverageScore}%` }} />
                              </div>
                              <span className="text-rose-300 font-medium w-8 text-right">{m.coverageScore}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.autonomousSteps}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.assistedSteps}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.blockedSteps}</td>
                          <td className="px-4 py-2 text-right text-gray-300">{m.totalWorkflowSteps}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${trendBadge(m.coverageTrend)}`}>
                              {m.coverageTrend}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${levelBadge(m.coverageLevel)}`}>
                              {m.coverageLevel}
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
