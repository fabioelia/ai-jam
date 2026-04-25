import React from 'react';
import { AgentHypothesisTestingRateAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentHypothesisTestingRateAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function ratingBadge(rating: string) {
  if (rating === 'excellent') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (rating === 'good') return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  if (rating === 'fair') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'stable') return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

export function AgentHypothesisTestingRateAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Hypothesis Testing Rate Analysis
            {result && (
              <span className="text-sm font-normal text-cyan-400/80 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing hypothesis testing rate...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No hypothesis testing rate data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg px-4 py-3">
                  <p className="text-cyan-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Hypothesis Score</p>
                  <p className="text-cyan-200 text-2xl font-bold">{result.fleetAvgHypothesisScore}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Quick Commit Agents</p>
                  <p className="text-orange-200 text-2xl font-bold">{result.quickCommitAgents}</p>
                  <p className="text-gray-500 text-xs mt-1">quick commit rate &gt; 70%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-white text-2xl font-bold">{result.metrics.length}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Testing Rate</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Avg Iter.</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Exp. Depth</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Quick Commit</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Trend</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentName}</td>
                        <td className="py-3 pr-4 text-cyan-400">{m.hypothesisScore}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.hypothesisTestingRate}%</td>
                        <td className="py-3 pr-4 text-gray-300">{m.avgIterationsPerSession}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.explorationDepth}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.quickCommitRate}%</td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(m.trend)}`}>
                            {m.trend}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${ratingBadge(m.rating)}`}>
                            {m.rating}
                          </span>
                        </td>
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
