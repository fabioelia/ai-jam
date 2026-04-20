import type { AgentAutonomyReport, AgentAutonomyMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentAutonomyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadge(tier: AgentAutonomyMetrics['autonomyTier']): string {
  switch (tier) {
    case 'highly_autonomous': return 'bg-violet-500/20 text-violet-400 border-violet-500/40';
    case 'autonomous': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'semi_autonomous': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'dependent': return 'bg-red-500/20 text-red-400 border-red-500/40';
  }
}

export default function AgentAutonomyIndexModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            AI Agent Autonomy Index
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing agent autonomy...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No autonomy data available.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-violet-200 text-xl font-bold">{result.summary.totalAgents}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Autonomy Score</p>
                  <p className="text-violet-200 text-xl font-bold">{result.summary.avgAutonomyScore}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Highly Autonomous</p>
                  <p className="text-violet-200 text-xl font-bold">{result.summary.highlyAutonomousAgents}</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Dependent Agents</p>
                  <p className="text-violet-200 text-xl font-bold">{result.summary.dependentAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Autonomy Tier</th>
                      <th className="px-4 py-3 text-center">Autonomy Score</th>
                      <th className="px-4 py-3 text-center">Autonomy Rate</th>
                      <th className="px-4 py-3 text-center">Escalations</th>
                      <th className="px-4 py-3 text-center">Avg Handoffs/Session</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${tierBadge(agent.autonomyTier)}`}>
                            {agent.autonomyTier.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-violet-500 rounded-full" style={{ width: `${agent.autonomyScore}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-8 text-right">{agent.autonomyScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{(agent.autonomyRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.escalatedSessions}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.avgHandoffsPerSession}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(result.insights.length > 0 || result.recommendations.length > 0) && (
                <div className="bg-gradient-to-r from-violet-900/20 to-purple-900/20 border border-violet-500/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-violet-300 font-semibold text-sm">AI Analysis</h3>
                  {result.insights.map((insight, i) => (
                    <p key={i} className="text-violet-100/80 text-sm flex items-start gap-2">
                      <span className="text-violet-400 mt-0.5">•</span>{insight}
                    </p>
                  ))}
                  {result.recommendations.map((rec, i) => (
                    <p key={i} className="text-violet-100/70 text-sm flex items-start gap-2">
                      <span className="text-violet-400 mt-0.5">→</span>{rec}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button onClick={onClose} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
