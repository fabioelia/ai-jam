import React from 'react';
import { AgentSemanticConsistencyRateAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentSemanticConsistencyRateAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'stable') return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function trendArrow(trend: string) {
  if (trend === 'improving') return '↑';
  if (trend === 'stable') return '→';
  return '↓';
}

export function AgentSemanticConsistencyRateAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-400" />
            Semantic Consistency Rate Analyzer
            {result && (
              <span className="text-sm font-normal text-stone-400/80 border border-stone-500/30 bg-stone-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing semantic consistency...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400 text-sm">No semantic consistency data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-stone-900/20 border border-stone-500/30 rounded-lg px-4 py-3">
                  <p className="text-stone-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Consistency</p>
                  <p className="text-stone-200 text-2xl font-bold">{result.fleetAvgConsistencyRate}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Agents</p>
                  <p className="text-white text-2xl font-bold">{result.metrics.length}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Stable</p>
                  <p className="text-green-200 text-2xl font-bold">{result.stableAgents}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Degrading</p>
                  <p className="text-red-200 text-2xl font-bold">{result.degradingAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Consistency %</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Consistent / Total</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Drift Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Top Category</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentId}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-stone-400 h-1.5 rounded-full" style={{ width: `${m.semanticConsistencyRate}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-10">{m.semanticConsistencyRate}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-300">{m.consistentResponses} / {m.totalPromptPairs}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.driftScore.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-gray-400 text-xs truncate max-w-[120px]">
                          {m.consistencyByCategory.length > 0 ? m.consistencyByCategory[0].category.replace(/_/g, ' ') : '—'}
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${trendBadge(m.stabilityTrend)}`}>
                            {trendArrow(m.stabilityTrend)} {m.stabilityTrend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.metrics.length > 0 && result.metrics[0].consistencyByCategory.length > 0 && (
                <div>
                  <h3 className="text-stone-400 text-xs font-medium uppercase tracking-wide mb-3">Category Breakdown (Top Agent)</h3>
                  <div className="space-y-2">
                    {result.metrics[0].consistencyByCategory.map(cat => (
                      <div key={cat.category} className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs w-40 truncate">{cat.category.replace(/_/g, ' ')}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                          <div className="bg-stone-400 h-1.5 rounded-full" style={{ width: `${cat.rate}%` }} />
                        </div>
                        <span className="text-gray-300 text-xs w-10 text-right">{cat.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
