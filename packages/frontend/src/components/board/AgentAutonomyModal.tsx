import type { AgentAutonomyReport, AgentAutonomyMetrics } from '../../api/mutations.js';

interface AgentAutonomyModalProps {
  result: AgentAutonomyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function levelBadgeClass(level: AgentAutonomyMetrics['autonomyLevel']): string {
  switch (level) {
    case 'high': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'medium': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'low': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function scoreBarClass(level: AgentAutonomyMetrics['autonomyLevel']): string {
  switch (level) {
    case 'high': return 'bg-green-500';
    case 'medium': return 'bg-blue-500';
    case 'low': return 'bg-yellow-500';
    default: return 'bg-red-500';
  }
}

export default function AgentAutonomyModal({ result, isOpen, loading, onClose }: AgentAutonomyModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Agent Autonomy Level Analyzer
            {result && (
              <span className="text-sm font-normal text-purple-400/80 border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 rounded-full">
                avg {result.summary.avgAutonomyScore}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing agent autonomy levels...</span>
              </div>
            </div>
          ) : !result || result.agentMetrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-gray-400 text-sm">No agent data found for autonomy analysis.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Score</p>
                  <p className="text-purple-200 text-sm font-semibold">{result.summary.avgAutonomyScore}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Most Autonomous</p>
                  <p className="text-green-200 text-sm font-semibold truncate">{result.summary.mostAutonomous || '—'}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Most Dependent</p>
                  <p className="text-red-200 text-sm font-semibold truncate">{result.summary.mostDependent || '—'}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">High Autonomy</p>
                  <p className="text-blue-200 text-sm font-semibold">{result.summary.highAutonomyCount}</p>
                </div>
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Autonomy Score</th>
                      <th className="px-4 py-3 text-center">Level</th>
                      <th className="px-4 py-3 text-center">Self-Completion %</th>
                      <th className="px-4 py-3 text-center">Redirection %</th>
                      <th className="px-4 py-3 text-center">Escalations</th>
                      <th className="px-4 py-3 text-center">Avg Handoffs/Ticket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agentMetrics.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.personaId}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${scoreBarClass(agent.autonomyLevel)}`}
                                style={{ width: `${agent.autonomyScore}%` }}
                              />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.autonomyScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${levelBadgeClass(agent.autonomyLevel)}`}>
                            {agent.autonomyLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.selfCompletionRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.redirectionRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.escalationCount}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.avgHandoffsPerTicket}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI summary section */}
              {(result.aiSummary || (result.recommendations && result.recommendations.length > 0)) && (
                <div className="bg-gradient-to-br from-purple-900/20 to-violet-900/20 border border-purple-500/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-purple-300 font-semibold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </h3>
                  {result.aiSummary && (
                    <p className="text-purple-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                  )}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <ul className="space-y-1">
                      {result.recommendations.map((rec, i) => (
                        <li key={i} className="text-purple-100/70 text-sm flex items-start gap-2">
                          <span className="text-purple-400 mt-0.5">•</span>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
