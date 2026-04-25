import React from 'react';
import { AgentMultiModalProcessingEfficiencyReport } from '../../api/mutations';

interface Props {
  result: AgentMultiModalProcessingEfficiencyReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'declining') return 'bg-red-500/20 border-red-500/30 text-red-400';
  return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
}

export function AgentMultiModalProcessingEfficiencyAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Multi-Modal Processing Efficiency
            {result && (
              <span className="text-sm font-normal text-amber-400/80 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing multi-modal processing efficiency...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <p className="text-gray-400 text-sm">No multi-modal processing data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-3">
                  <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-1">Efficiency Score</p>
                  <p className="text-amber-200 text-2xl font-bold">{result.summary.efficiencyScore}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Text Processing</p>
                  <p className="text-white text-2xl font-bold">{result.summary.textProcessingRate.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Most Efficient</p>
                  <p className="text-white text-sm font-semibold truncate">{result.summary.mostEfficientAgent || '—'}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Least Efficient</p>
                  <p className="text-white text-sm font-semibold truncate">{result.summary.leastEfficientAgent || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Code Processing</p>
                  <p className="text-blue-400 text-xl font-bold">{result.summary.codeProcessingRate.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Structured Data</p>
                  <p className="text-purple-400 text-xl font-bold">{result.summary.structuredDataRate.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Cross-Modal Integration</p>
                  <p className="text-green-400 text-xl font-bold">{result.summary.crossModalIntegrationRate.toFixed(1)}%</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Efficiency</th>
                      <th className="px-4 py-3 text-center">Total Inputs</th>
                      <th className="px-4 py-3 text-center">Cross-Modal Rate</th>
                      <th className="px-4 py-3 text-center">Failure Rate</th>
                      <th className="px-4 py-3 text-center">Trend</th>
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
                                className="h-1.5 rounded-full bg-amber-500"
                                style={{ width: `${m.efficiencyScore}%` }}
                              />
                            </div>
                            <span className="text-amber-400">{m.efficiencyScore}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.totalMultiModalInputs}</td>
                        <td className="px-4 py-3 text-center text-green-400">{m.crossModalIntegrationRate.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center text-red-400">{m.failureRate.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(m.trend)}`}>{m.trend}</span>
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
