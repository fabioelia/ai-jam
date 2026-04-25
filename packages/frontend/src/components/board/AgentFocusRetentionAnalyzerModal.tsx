import React from 'react';
import { AgentFocusRetentionAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentFocusRetentionAnalyzerReport | null;
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

export function AgentFocusRetentionAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            Focus Retention Analysis
            {result && (
              <span className="text-sm font-normal text-teal-400/80 border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing focus retention...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p className="text-gray-400 text-sm">No focus retention data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Focus Score</p>
                  <p className="text-teal-200 text-2xl font-bold">{result.avg_focus_score}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Drift Rate</p>
                  <p className="text-red-200 text-2xl font-bold">{result.overall_drift_rate}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Drift Incidents</p>
                  <p className="text-white text-2xl font-bold">{result.total_drift_incidents}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Trend</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${trendBadge(result.trend)}`}>
                    {trendArrow(result.trend)} {result.trend}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-900/10 border border-teal-800/40 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Drift Point</p>
                  <p className="text-white text-lg font-semibold">{result.avg_drift_point}% into session</p>
                  <p className="text-gray-500 text-xs mt-1">Agents typically drift after reaching this point</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Top Drift Triggers</p>
                  <ul className="space-y-1">
                    {result.topDriftTriggers.map((trigger, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                        {trigger}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Focus Score</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Drift Rate</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Sessions w/ Drift</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Drift Point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentId}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-teal-400 h-1.5 rounded-full" style={{ width: `${m.avgFocusScore}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-8">{m.avgFocusScore}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-red-400">{m.driftRate}%</td>
                        <td className="py-3 pr-4 text-gray-300">{m.sessionsWithDrift}/{m.totalSessions}</td>
                        <td className="py-3 text-teal-400">{m.avgDriftPoint}%</td>
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
