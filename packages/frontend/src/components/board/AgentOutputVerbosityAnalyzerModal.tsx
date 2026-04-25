import React from 'react';
import { AgentOutputVerbosityAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentOutputVerbosityAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'stable') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'improving') return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function trendArrow(trend: string) {
  if (trend === 'stable') return '→';
  if (trend === 'improving') return '↑';
  return '↓';
}

export function AgentOutputVerbosityAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Output Verbosity Analysis
            {result && (
              <span className="text-sm font-normal text-orange-400/80 border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing output verbosity...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-400 text-sm">No verbosity data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Verbosity Score</p>
                  <p className="text-orange-200 text-2xl font-bold">{result.avg_verbosity_score}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Verbosity Ratio</p>
                  <p className="text-white text-2xl font-bold">{result.avg_verbosity_ratio.toFixed(2)}x</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Sessions</p>
                  <p className="text-white text-2xl font-bold">{result.total_sessions}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Trend</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${trendBadge(result.trend)}`}>
                    {trendArrow(result.trend)} {result.trend}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Optimal</p>
                  <p className="text-green-200 text-xl font-bold">{result.optimal_rate}%</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Over-Verbose</p>
                  <p className="text-orange-200 text-xl font-bold">{result.over_verbose_rate}%</p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-3">
                  <p className="text-yellow-400 text-xs font-medium uppercase tracking-wide mb-1">Under-Verbose</p>
                  <p className="text-yellow-200 text-xl font-bold">{result.under_verbose_rate}%</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Ratio</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Optimal</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Over</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Under</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentId}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${m.verbosityScore}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-8">{m.verbosityScore}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-300">{m.verbosityRatio.toFixed(2)}x</td>
                        <td className="py-3 pr-4 text-green-400">{m.optimalCount}</td>
                        <td className="py-3 pr-4 text-orange-400">{m.overVerboseCount}</td>
                        <td className="py-3 text-yellow-400">{m.underVerboseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
