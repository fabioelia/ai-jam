import type { AgentTaskAbandonmentReport, AgentTaskAbandonmentData } from '../../api/mutations.js';

interface Props {
  result: AgentTaskAbandonmentReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: AgentTaskAbandonmentData['abandonmentTier']): string {
  switch (tier) {
    case 'reliable': return 'bg-green-500/20 text-green-400 border-green-500/40';
    case 'moderate': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'inconsistent': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'volatile': return 'bg-red-500/20 text-red-400 border-red-500/40';
  }
}

export default function AgentTaskAbandonmentModal({ result, isOpen, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            AI Agent Task Abandonment Analyzer
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
                <span className="text-sm">Analyzing task abandonment patterns...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No task abandonment data available for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Total Tasks Started</p>
                  <p className="text-orange-200 text-xl font-bold">{result.summary.totalTasksStarted}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Abandonment Rate</p>
                  <p className="text-orange-200 text-xl font-bold">{result.summary.avgAbandonmentRate}%</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Most Reliable Agent</p>
                  <p className="text-orange-200 text-sm font-bold truncate">{result.summary.mostReliableAgent || '—'}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Low Abandonment Count</p>
                  <p className="text-orange-200 text-xl font-bold">{result.summary.lowAbandonmentCount}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Abandonment Rate</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Tasks Started</th>
                      <th className="px-4 py-3 text-center">Abandoned</th>
                      <th className="px-4 py-3 text-center">Avg Point</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-orange-500 rounded-full" style={{ width: `${Math.min(100, agent.abandonmentScore)}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-10 text-right">{agent.abandonmentRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${tierBadgeClass(agent.abandonmentTier)}`}>
                            {agent.abandonmentTier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.tasksStarted}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.tasksAbandoned}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.avgAbandonmentPoint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(result.aiSummary || result.aiRecommendations?.length > 0) && (
                <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/10 border border-orange-700/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-orange-300 font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </h3>
                  {result.aiSummary && (
                    <p className="text-orange-100/80 text-sm">{result.aiSummary}</p>
                  )}
                  {result.aiRecommendations?.length > 0 && (
                    <ul className="space-y-1">
                      {result.aiRecommendations.map((rec, i) => (
                        <li key={i} className="text-orange-100/70 text-sm flex items-start gap-2">
                          <span className="text-orange-400 mt-0.5">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
