import React from 'react';
import { AgentTaskAbandonmentRateAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentTaskAbandonmentRateAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'stable') return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

export function AgentTaskAbandonmentRateAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Task Abandonment Rate
            {result && (
              <span className="text-sm font-normal text-green-400/80 border border-green-500/20 bg-green-500/10 px-2 py-0.5 rounded-full">
                {result.total_tasks} tasks
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
                <span className="text-sm">Analyzing task abandonment rate...</span>
              </div>
            </div>
          ) : !result || result.total_tasks === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No task abandonment data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 col-span-2">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Abandonment Rate</p>
                  <div className="flex items-end gap-2">
                    <p className="text-green-200 text-3xl font-bold">{result.abandonment_rate}%</p>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${result.abandonment_rate}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Tasks</p>
                  <p className="text-gray-200 text-xl font-bold">{result.total_tasks}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Abandoned Tasks</p>
                  <p className="text-gray-200 text-xl font-bold">{result.abandoned_tasks}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Graceful Escalations</p>
                  <p className="text-green-200 text-xl font-bold">{result.graceful_escalations}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Silent Abandonments</p>
                  <p className="text-red-200 text-xl font-bold">{result.silent_abandonments}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Escalation Rate</p>
                  <p className="text-green-200 text-xl font-bold">{result.escalation_rate}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Completion Depth</p>
                  <p className="text-gray-200 text-xl font-bold">{result.avg_completion_depth_before_abandon.toFixed(2)}</p>
                </div>
              </div>
              {result.top_abandonment_reasons.length > 0 && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">Top Abandonment Reasons</p>
                  <div className="flex flex-col gap-1">
                    {result.top_abandonment_reasons.map((reason, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-red-400 text-xs font-bold">{i + 1}.</span>
                        <span className="text-gray-300 text-xs">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Trend</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(result.trend)}`}>
                    {result.trend}
                  </span>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Tasks</p>
                  <p className="text-gray-200 text-xl font-bold">{result.total_tasks}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Analysis Time</p>
                  <p className="text-gray-400 text-xs">{new Date(result.analysis_timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Highest Abandonment Agent</p>
                  <p className="text-red-200 text-sm font-semibold truncate">{result.highest_abandonment_agent || '—'}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Lowest Abandonment Agent</p>
                  <p className="text-green-200 text-sm font-semibold truncate">{result.lowest_abandonment_agent || '—'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
