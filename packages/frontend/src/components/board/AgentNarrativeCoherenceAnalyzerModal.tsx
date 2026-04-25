import React from 'react';
import { AgentNarrativeCoherenceReport } from '../../api/mutations';

interface Props {
  result: AgentNarrativeCoherenceReport | null;
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

export function AgentNarrativeCoherenceAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Narrative Coherence
            {result && (
              <span className="text-sm font-normal text-yellow-400/80 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing narrative coherence...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No coherence data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-4 py-3">
                  <p className="text-yellow-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Coherence Score</p>
                  <p className="text-yellow-200 text-2xl font-bold">{result.coherenceScore}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Coherent Rate</p>
                  <p className="text-green-200 text-2xl font-bold">{result.coherentRate}%</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Contradiction Rate</p>
                  <p className="text-red-200 text-2xl font-bold">{result.contradictionRate}%</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Topic Drift Rate</p>
                  <p className="text-orange-200 text-2xl font-bold">{result.topicDriftRate}%</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Coherent Turns</p>
                  <p className="text-blue-200 text-2xl font-bold">{result.avgCoherentTurns}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Incoherence Causes</p>
                  <p className="text-gray-200 text-xs mt-1">
                    <span className="text-red-400">Contradictions: {result.incoherenceCauses.contradictions}</span>
                    {' · '}
                    <span className="text-orange-400">Topic Jumps: {result.incoherenceCauses.topicJumps}</span>
                    {' · '}
                    <span className="text-yellow-400">Context Loss: {result.incoherenceCauses.contextLoss}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 flex gap-2 items-center">
                  <span className="text-gray-400">Most Coherent:</span>
                  <span className="text-yellow-400 font-medium">{result.mostCoherentAgent}</span>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 flex gap-2 items-center">
                  <span className="text-gray-400">Least Coherent:</span>
                  <span className="text-red-400 font-medium">{result.leastCoherentAgent}</span>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 flex gap-2 items-center">
                  <span className="text-gray-400">Fleet Trend:</span>
                  <span className={`font-medium ${result.trend === 'improving' ? 'text-green-400' : result.trend === 'worsening' ? 'text-red-400' : 'text-gray-400'}`}>{result.trend}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Coherent%</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Contradict%</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Drift%</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Avg Turns</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Trend</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentName}</td>
                        <td className="py-3 pr-4 text-yellow-400">{m.coherenceScore}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.coherentRate}%</td>
                        <td className="py-3 pr-4 text-gray-300">{m.contradictionRate}%</td>
                        <td className="py-3 pr-4 text-gray-300">{m.topicDriftRate}%</td>
                        <td className="py-3 pr-4 text-gray-300">{m.avgCoherentTurns}</td>
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
