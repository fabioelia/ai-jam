import type { AgentHandoffQualityReport, AgentHandoffRole } from '../../api/mutations.js';

interface Props {
  result: AgentHandoffQualityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const ROLE_STYLES: Record<AgentHandoffRole['role'], string> = {
  initiator: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  receiver: 'bg-green-900/50 text-green-300 border border-green-700/50',
  collaborator: 'bg-purple-900/50 text-purple-300 border border-purple-700/50',
  isolated: 'bg-gray-800/50 text-gray-400 border border-gray-600/50',
};

export default function AgentHandoffQualityModal({ result, isOpen, loading, onClose }: Props) {
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
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Agent Handoff Quality
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
                <span className="text-sm">Analyzing handoff quality...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No handoff data found for analysis.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Total Handoffs</p>
                  <p className="text-cyan-200 text-sm font-semibold">{result.summary.totalHandoffs}</p>
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Context Score</p>
                  <p className="text-cyan-200 text-sm font-semibold">{result.summary.avgContextScore}</p>
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Top Sender</p>
                  <p className="text-cyan-200 text-sm font-semibold truncate">{result.summary.topSender || '—'}</p>
                </div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Low Quality</p>
                  <p className="text-cyan-200 text-sm font-semibold">{result.summary.lowQualityHandoffCount}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Role</th>
                      <th className="px-4 py-3 text-center">Sent</th>
                      <th className="px-4 py-3 text-center">Received</th>
                      <th className="px-4 py-3 text-center">Avg Context</th>
                      <th className="px-4 py-3 text-center">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${ROLE_STYLES[agent.role]}`}>
                            {agent.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.handoffsSent}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.handoffsReceived}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.avgContextScore}</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{Math.round(agent.handoffEfficiency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(result.insights.length > 0 || result.recommendations.length > 0) && (
                <div className="space-y-3">
                  {result.insights.length > 0 && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-2">Insights</p>
                      <ul className="space-y-1">
                        {result.insights.map((ins, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-cyan-400 shrink-0">•</span>{ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.recommendations.length > 0 && (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                      <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-cyan-400 shrink-0">•</span>{rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
