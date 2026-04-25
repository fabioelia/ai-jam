import React from 'react';
import { AgentDelegationAccuracyReport } from '../../api/mutations';

interface Props {
  result: AgentDelegationAccuracyReport | null;
  loading: boolean;
  onClose: () => void;
}

function delegationRiskBadge(risk: string) {
  if (risk === 'high') return 'bg-red-500/20 border-red-500/30 text-red-400';
  if (risk === 'moderate') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  return 'bg-green-500/20 border-green-500/30 text-green-400';
}

export function AgentDelegationAccuracyAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
            Delegation Accuracy Analyzer
            {result && (
              <span className="text-sm font-normal text-fuchsia-400/80 border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 rounded-full">
                {result.agents.length} agents
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
                <span className="text-sm">Analyzing delegation accuracy...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="text-gray-400 text-sm">No delegation accuracy data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-fuchsia-900/20 border border-fuchsia-500/30 rounded-lg px-4 py-3">
                  <p className="text-fuchsia-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Accuracy Rate</p>
                  <p className="text-fuchsia-200 text-2xl font-bold">{(result.summary.avgRate * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Most Accurate</p>
                  <p className="text-white text-sm font-semibold truncate">{result.summary.mostAccurate || '—'}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Least Accurate</p>
                  <p className="text-white text-sm font-semibold truncate">{result.summary.leastAccurate || '—'}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Accuracy</th>
                      <th className="px-4 py-3 text-center">Total / Correct</th>
                      <th className="px-4 py-3 text-center">Re-Delegation</th>
                      <th className="px-4 py-3 text-center">Latency (ms)</th>
                      <th className="px-4 py-3 text-center">Downstream</th>
                      <th className="px-4 py-3 text-center">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.agentId}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-fuchsia-500"
                                style={{ width: `${m.delegationAccuracyRate * 100}%` }}
                              />
                            </div>
                            <span className="text-fuchsia-400">{(m.delegationAccuracyRate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.totalDelegations} / {m.correctDelegations}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{(m.reDelegationRate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.avgDelegationLatencyMs.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-fuchsia-400"
                                style={{ width: `${m.downstreamSuccessRate * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-300">{(m.downstreamSuccessRate * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${delegationRiskBadge(m.delegationRisk)}`}>{m.delegationRisk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

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
