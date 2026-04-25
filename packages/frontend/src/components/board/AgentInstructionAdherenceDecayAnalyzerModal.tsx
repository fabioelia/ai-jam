import React from 'react';
import { AgentInstructionAdherenceDecayReport } from '../../api/mutations';

interface Props {
  result: AgentInstructionAdherenceDecayReport | null;
  loading: boolean;
  onClose: () => void;
}

function decayBadge(rating: string) {
  if (rating === 'minimal') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (rating === 'moderate') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  if (rating === 'high') return 'bg-orange-500/20 border-orange-500/30 text-orange-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'stable') return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

export function AgentInstructionAdherenceDecayAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Instruction Adherence Decay
            {result && (
              <span className="text-sm font-normal text-violet-400/80 border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing instruction adherence decay...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No adherence decay data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Decay Rate</p>
                  <p className="text-violet-200 text-2xl font-bold">{result.avgDecayRate}%</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Initial Adherence</p>
                  <p className="text-blue-200 text-2xl font-bold">{result.avgInitialAdherence}%</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Final Adherence</p>
                  <p className="text-orange-200 text-2xl font-bold">{result.avgFinalAdherence}%</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 flex gap-2 items-center">
                  <span className="text-gray-400">Most Stable:</span>
                  <span className="text-green-400 font-medium">{result.mostStableAgent}</span>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 flex gap-2 items-center">
                  <span className="text-gray-400">Highest Decay:</span>
                  <span className="text-red-400 font-medium">{result.highestDecayAgent}</span>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 flex gap-2 items-center">
                  <span className="text-gray-400">Fleet Trend:</span>
                  <span className={`font-medium ${result.fleetTrend === 'improving' ? 'text-green-400' : result.fleetTrend === 'worsening' ? 'text-red-400' : 'text-gray-400'}`}>{result.fleetTrend}</span>
                </div>
              </div>
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">Session Timeline (Avg Initial vs Final Fidelity)</p>
                <div className="flex gap-2 items-end h-16">
                  {result.sessionTimelineByDecay.map((pt) => (
                    <div key={pt.sessionIndex} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '48px' }}>
                        <div
                          className="bg-blue-500/60 rounded-sm w-2"
                          style={{ height: `${Math.max(2, (pt.avgInitial / 100) * 48)}px` }}
                          title={`Initial: ${pt.avgInitial}%`}
                        />
                        <div
                          className="bg-violet-500/60 rounded-sm w-2"
                          style={{ height: `${Math.max(2, (pt.avgFinal / 100) * 48)}px` }}
                          title={`Final: ${pt.avgFinal}%`}
                        />
                      </div>
                      <span className="text-gray-500 text-xs">{pt.sessionIndex}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span><span className="inline-block w-2 h-2 bg-blue-500/60 rounded-sm mr-1" />Initial</span>
                  <span><span className="inline-block w-2 h-2 bg-violet-500/60 rounded-sm mr-1" />Final</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Initial%</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Final%</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Decay%</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Worst</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Sessions</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Trend</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentName}</td>
                        <td className="py-3 pr-4 text-blue-400">{m.initialAdherence}%</td>
                        <td className="py-3 pr-4 text-violet-400">{m.finalAdherence}%</td>
                        <td className="py-3 pr-4 text-orange-400">{m.decayRate}%</td>
                        <td className="py-3 pr-4 text-red-400">{m.worstDecaySession}%</td>
                        <td className="py-3 pr-4 text-gray-300">{m.totalSessions}</td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(m.trend)}`}>
                            {m.trend}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${decayBadge(m.decayRating)}`}>
                            {m.decayRating}
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
