import React from 'react';
import { AgentSessionDepthReport, AgentSessionDepthProfile } from '../../api/mutations.js';

interface Props {
  result: AgentSessionDepthReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const CATEGORY_STYLES: Record<AgentSessionDepthProfile['depthCategory'], string> = {
  deep: 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50',
  moderate: 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50',
  shallow: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  'pass-through': 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
};

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

export default function AgentSessionDepthModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  const sorted = result ? [...result.agents].sort((a, b) => b.depthScore - a.depthScore) : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Session Depth Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.agents.length} agent{result.agents.length !== 1 ? 's' : ''} analyzed
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing agent session depth...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent session data available for this project
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Avg Depth Score</p>
                  <p className="text-2xl font-bold text-white">{result.avgDepthScore}</p>
                  <p className="text-xs text-gray-500">/100</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Deepest Agent</p>
                  <p className="text-sm font-semibold text-indigo-300 truncate">{result.deepestAgent ?? '—'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Shallowest Agent</p>
                  <p className="text-sm font-semibold text-orange-300 truncate">{result.shallowestAgent ?? '—'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Pass-Through</p>
                  <p className="text-2xl font-bold text-orange-400">{result.passThroughCount}</p>
                  <p className="text-xs text-gray-500">agent{result.passThroughCount !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3 pr-4 font-medium">Persona</th>
                      <th className="pb-3 pr-4 font-medium text-center">Category</th>
                      <th className="pb-3 pr-4 font-medium text-right">Tickets/Session</th>
                      <th className="pb-3 pr-4 font-medium text-right">Handoffs Sent</th>
                      <th className="pb-3 pr-4 font-medium text-right">Duration (h)</th>
                      <th className="pb-3 font-medium text-right">Depth Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sorted.map((agent) => (
                      <tr key={agent.personaId} className="hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium">{agent.personaId}</td>
                        <td className="py-3 pr-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[agent.depthCategory]}`}>
                            {agent.depthCategory}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-300">{fmt(agent.avgTicketsPerSession)}</td>
                        <td className="py-3 pr-4 text-right text-gray-300">{fmt(agent.avgHandoffsSentPerSession)}</td>
                        <td className="py-3 pr-4 text-right text-gray-300">{fmt(agent.avgSessionDurationHours)}</td>
                        <td className="py-3 text-right">
                          <span className={`font-bold ${
                            agent.depthScore >= 70 ? 'text-indigo-400' :
                            agent.depthScore >= 45 ? 'text-cyan-400' :
                            agent.depthScore >= 20 ? 'text-yellow-400' : 'text-orange-400'
                          }`}>
                            {agent.depthScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Summary */}
              {result.aiSummary && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">AI Analysis</h3>
                  <p className="text-sm text-gray-400">{result.aiSummary}</p>
                </div>
              )}

              {/* Recommendations */}
              {result.aiRecommendations && result.aiRecommendations.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Recommendations</h3>
                  <ul className="space-y-1">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-400 flex gap-2">
                        <span className="text-indigo-400 shrink-0">•</span>
                        <span>{rec}</span>
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
