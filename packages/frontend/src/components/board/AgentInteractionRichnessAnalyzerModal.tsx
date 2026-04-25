import React from 'react';
import { AgentInteractionRichnessAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentInteractionRichnessAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function categoryBadge(cat: string) {
  if (cat === 'deep') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (cat === 'rich') return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  if (cat === 'moderate') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function pct(v: number) { return Math.round(v * 100); }

export function AgentInteractionRichnessAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Interaction Richness Analyzer
            {result && (
              <span className="text-sm font-normal text-purple-400/80 border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing interaction richness...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <p className="text-gray-400 text-sm">No interaction richness data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Score</p>
                  <p className="text-purple-200 text-2xl font-bold">{pct(result.fleetAvgRichnessScore)}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Agents</p>
                  <p className="text-white text-2xl font-bold">{result.metrics.length}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Deep Interactions</p>
                  <p className="text-green-200 text-2xl font-bold">{result.deepInteractionAgents}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Shallow</p>
                  <p className="text-red-200 text-2xl font-bold">{result.shallowInteractionAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Richness Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Avg Turns</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Tool Variety</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Context Depth</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentName}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct(m.interactionRichnessScore)}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-10">{pct(m.interactionRichnessScore)}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-300">{m.avgTurnsPerSession}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[40px]">
                              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct(m.toolVarietyIndex)}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-10">{pct(m.toolVarietyIndex)}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[40px]">
                              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct(m.contextDepthScore)}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-10">{pct(m.contextDepthScore)}%</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${categoryBadge(m.richnessCategory)}`}>
                            {m.richnessCategory}
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
