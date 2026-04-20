import type { AgentCollaborationGraphReport, AgentNetworkProfile } from '../../api/mutations.js';

interface AgentCollaborationGraphModalProps {
  result: AgentCollaborationGraphReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function roleBadgeClass(role: AgentNetworkProfile['role']): string {
  switch (role) {
    case 'hub': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'bridge': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'contributor': return 'bg-green-500/20 text-green-300 border-green-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function formatRole(role: AgentNetworkProfile['role']): string {
  switch (role) {
    case 'hub': return 'Hub';
    case 'bridge': return 'Bridge';
    case 'contributor': return 'Contributor';
    case 'isolated': return 'Isolated';
  }
}

export default function AgentCollaborationGraphModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentCollaborationGraphModalProps) {
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            AI Agent Collaboration Graph Analyzer
            {result && (
              <span className="text-sm font-normal text-violet-400/80 border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 rounded-full">
                {result.edges.length} edges · {result.agents.length} agents
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
                <span className="text-sm">Analyzing agent collaboration graph...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-gray-400 text-sm">No agent collaboration data found for this project.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Network Density</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.networkDensity.toFixed(3)}</p>
                </div>
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg px-4 py-3">
                  <p className="text-indigo-400 text-xs font-medium uppercase tracking-wide mb-1">Strongest Pair</p>
                  <p className="text-indigo-200 text-sm font-semibold">
                    {result.strongestPair ? `${result.strongestPair.source} → ${result.strongestPair.target}` : '—'}
                  </p>
                </div>
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Most Active Collaborator</p>
                  <p className="text-violet-200 text-sm font-semibold">
                    {result.mostActiveCollaborators && result.mostActiveCollaborators.length > 0 ? result.mostActiveCollaborators[0] : '—'}
                  </p>
                </div>
                <div className="bg-gray-800/60 border border-gray-600/30 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Most Isolated Agent</p>
                  <p className="text-gray-200 text-sm font-semibold">{result.mostIsolatedAgent ?? '—'}</p>
                </div>
              </div>

              {/* Edges table */}
              <div>
                <h3 className="text-gray-300 font-semibold text-sm mb-2">Collaboration Edges</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Source</th>
                        <th className="px-4 py-3 text-center">→</th>
                        <th className="px-4 py-3 text-left">Target</th>
                        <th className="px-4 py-3 text-center">Strength</th>
                        <th className="px-4 py-3 text-center">Handoffs</th>
                        <th className="px-4 py-3 text-center">Success Rate</th>
                        <th className="px-4 py-3 text-center">Avg Context Len</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {result.edges.map((edge, i) => (
                        <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{edge.sourcePersonaId}</td>
                          <td className="px-4 py-3 text-center text-gray-500">→</td>
                          <td className="px-4 py-3 text-white font-medium">{edge.targetPersonaId}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-400"
                                  style={{ width: `${Math.min(100, edge.collaborationStrength * 100)}%` }}
                                />
                              </div>
                              <span className="text-gray-200 font-mono text-xs">{edge.collaborationStrength.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">{edge.handoffCount}</td>
                          <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{(edge.successRate * 100).toFixed(1)}%</td>
                          <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{edge.avgContextLength.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agent profiles table */}
              <div>
                <h3 className="text-gray-300 font-semibold text-sm mb-2">Agent Network Profiles</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Persona</th>
                        <th className="px-4 py-3 text-center">Role</th>
                        <th className="px-4 py-3 text-center">Centrality Score</th>
                        <th className="px-4 py-3 text-center">Total Handoffs</th>
                        <th className="px-4 py-3 text-center">Unique Collaborators</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {result.agents.map((agent, i) => (
                        <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{agent.personaId}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${roleBadgeClass(agent.role)}`}>
                              {formatRole(agent.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.centralityScore.toFixed(3)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{agent.totalHandoffs}</td>
                          <td className="px-4 py-3 text-center text-gray-400">{agent.uniqueCollaborators}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Summary + Recommendations */}
              <div className="bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-violet-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                {result.aiSummary && (
                  <p className="text-violet-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                )}
                {result.recommendations && result.recommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-violet-100/70 text-sm flex items-start gap-2">
                        <span className="text-violet-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
