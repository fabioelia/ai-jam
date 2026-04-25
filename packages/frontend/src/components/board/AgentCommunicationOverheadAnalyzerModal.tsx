import React from 'react';
import { AgentCommunicationOverheadAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentCommunicationOverheadAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'increasing') return 'bg-red-500/20 border-red-500/30 text-red-400';
  if (trend === 'decreasing') return 'bg-green-500/20 border-green-500/30 text-green-400';
  return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
}

export function AgentCommunicationOverheadAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Communication Overhead Analyzer
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
                <span className="text-sm">Analyzing communication overhead...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-gray-400 text-sm">No communication overhead data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Overhead Ratio</p>
                  <p className="text-orange-200 text-2xl font-bold">{result.fleetAvgOverheadRatio.toFixed(3)}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">High Overhead Agents</p>
                  <p className="text-red-200 text-xl font-bold flex items-center gap-2">
                    {result.highOverheadAgents}
                    {result.highOverheadAgents > 0 && (
                      <span className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded-full">ratio &gt; 0.5</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Overhead Ratio</th>
                      <th className="px-4 py-3 text-center">Messages</th>
                      <th className="px-4 py-3 text-center">Avg Latency (ms)</th>
                      <th className="px-4 py-3 text-center">Coord Cost/Task</th>
                      <th className="px-4 py-3 text-center">Sessions</th>
                      <th className="px-4 py-3 text-center">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.metrics.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${m.communicationOverheadRatio > 0.5 ? 'bg-red-500' : m.communicationOverheadRatio > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(100, m.communicationOverheadRatio * 100)}%` }}
                              />
                            </div>
                            <span className="text-orange-400">{m.communicationOverheadRatio.toFixed(3)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.messageCount}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.avgResponseLatencyMs}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{m.coordinationCostPerTask.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{m.totalSessions}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(m.overheadTrend)}`}>{m.overheadTrend}</span>
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
