import type { AgentLearningVelocityReport, AgentLearningMetrics } from '../../api/mutations.js';

interface Props {
  report: AgentLearningVelocityReport | null;
  onClose: () => void;
}

function trendBadge(trend: AgentLearningMetrics['trend']): string {
  switch (trend) {
    case 'improving': return 'bg-green-100 text-green-800';
    case 'regressing': return 'bg-red-100 text-red-800';
    default: return 'bg-yellow-100 text-yellow-800';
  }
}

function phaseBadge(phase: AgentLearningMetrics['learningPhase']): string {
  switch (phase) {
    case 'expert': return 'bg-blue-100 text-blue-800';
    case 'proficient': return 'bg-indigo-100 text-indigo-800';
    case 'learning': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function AgentLearningVelocityModal({ report, onClose }: Props) {
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
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            AI Agent Learning Velocity
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!report || report.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No learning velocity data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Velocity</p>
                  <p className="text-violet-200 text-sm font-semibold">{report.avgVelocityScore}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Fastest Learner</p>
                  <p className="text-green-200 text-sm font-semibold truncate">{report.fastestLearner || '—'}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Most Regressing</p>
                  <p className="text-red-200 text-sm font-semibold truncate">{report.mostRegressing || '—'}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">System Delta</p>
                  <p className="text-blue-200 text-sm font-semibold">{report.systemImprovementDelta > 0 ? '+' : ''}{report.systemImprovementDelta}%</p>
                </div>
              </div>

              {/* Agent Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Phase</th>
                      <th className="px-4 py-3 text-center">Trend</th>
                      <th className="px-4 py-3 text-center w-32">Velocity</th>
                      <th className="px-4 py-3 text-center">Early %</th>
                      <th className="px-4 py-3 text-center">Recent %</th>
                      <th className="px-4 py-3 text-center">Delta</th>
                      <th className="px-4 py-3 text-center">Sessions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {report.agents.map((agent) => (
                      <tr key={agent.personaId} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-200 font-medium">{agent.personaId}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${phaseBadge(agent.learningPhase)}`}>
                            {agent.learningPhase}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${trendBadge(agent.trend)}`}>
                            {agent.trend}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-500 rounded-full"
                                style={{ width: `${agent.velocityScore}%` }}
                              />
                            </div>
                            <span className="text-gray-400 text-xs w-8 text-right">{agent.velocityScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.earlySuccessRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.recentSuccessRate}%</td>
                        <td className={`px-4 py-3 text-center font-medium ${agent.improvementDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {agent.improvementDelta > 0 ? '+' : ''}{agent.improvementDelta}%
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalSessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Summary */}
              {report.aiSummary && (
                <div className="bg-gray-800/40 rounded-lg p-4">
                  <h3 className="text-gray-300 text-sm font-medium mb-2">AI Summary</h3>
                  <p className="text-gray-400 text-sm">{report.aiSummary}</p>
                </div>
              )}

              {/* AI Recommendations */}
              {report.aiRecommendations.length > 0 && (
                <div className="bg-violet-900/10 border border-violet-500/20 rounded-lg p-4 space-y-2">
                  <h3 className="text-violet-300 text-sm font-medium">AI Recommendations</h3>
                  <ul className="space-y-1">
                    {report.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-gray-400 text-sm flex gap-2">
                        <span className="text-violet-400 mt-0.5">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
