import React from 'react';
import { AgentInstructionDisambiguationRateAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentInstructionDisambiguationRateAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function ratingBadge(rating: string) {
  if (rating === 'excellent') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (rating === 'good') return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  if (rating === 'fair') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function adaptationBadge(level: string) {
  if (level === 'high') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (level === 'medium') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

export function AgentInstructionDisambiguationRateAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-lime-500" />
            Instruction Disambiguation Rate
            {result && (
              <span className="text-sm font-normal text-lime-400/80 border border-lime-500/30 bg-lime-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing instruction disambiguation rate...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-lime-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No disambiguation data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="bg-lime-900/20 border border-lime-500/30 rounded-lg px-4 py-3">
                  <p className="text-lime-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Score</p>
                  <p className="text-lime-200 text-2xl font-bold">{result.fleetAvgDisambiguationScore}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Agents Analyzed</p>
                  <p className="text-white text-2xl font-bold">{result.metrics.length}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">High Clarification</p>
                  <p className="text-orange-200 text-2xl font-bold">{result.highClarificationAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-3 pr-4">Agent</th>
                      <th className="text-right text-gray-400 font-medium pb-3 pr-4">Score</th>
                      <th className="text-right text-gray-400 font-medium pb-3 pr-4">Self-Disambig %</th>
                      <th className="text-right text-gray-400 font-medium pb-3 pr-4">Clarif. Rate %</th>
                      <th className="text-right text-gray-400 font-medium pb-3 pr-4">1st Pass %</th>
                      <th className="text-right text-gray-400 font-medium pb-3 pr-4">Avg Resolve (min)</th>
                      <th className="text-right text-gray-400 font-medium pb-3 pr-4">Sessions</th>
                      <th className="text-center text-gray-400 font-medium pb-3 pr-4">Clarity</th>
                      <th className="text-center text-gray-400 font-medium pb-3">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="text-white font-medium truncate max-w-[140px] block">{m.agentName}</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="text-lime-400 font-semibold">{m.disambiguationScore}%</span>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-300">{m.selfDisambiguationRate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-300">{m.clarificationRequestRate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-300">{m.firstPassSuccessRate}%</td>
                        <td className="py-3 pr-4 text-right text-gray-300">{m.avgResolutionTime.toFixed(1)}</td>
                        <td className="py-3 pr-4 text-right text-gray-400">{m.totalSessions}</td>
                        <td className="py-3 pr-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${adaptationBadge(m.clarityAdaptation)}`}>
                            {m.clarityAdaptation}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${ratingBadge(m.rating)}`}>
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
