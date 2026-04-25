import React from 'react';
import { AgentInstructionOverloadDetectorReport } from '../../api/mutations';

interface Props {
  result: AgentInstructionOverloadDetectorReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'stable') return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

export function AgentInstructionOverloadDetectorModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Instruction Overload
            {result && (
              <span className="text-sm font-normal text-indigo-400/80 border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                {result.total_sessions} sessions
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
                <span className="text-sm">Detecting instruction overload...</span>
              </div>
            </div>
          ) : !result || result.total_sessions === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No instruction overload data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-3 col-span-2">
                  <p className="text-indigo-400 text-xs font-medium uppercase tracking-wide mb-1">Overload Score</p>
                  <div className="flex items-end gap-2">
                    <p className="text-indigo-200 text-3xl font-bold">{result.overload_score}</p>
                    <p className="text-indigo-400/60 text-sm mb-0.5">/ 100</p>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${result.overload_score}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Instructions / Session</p>
                  <p className="text-gray-200 text-xl font-bold">{result.avg_instructions_per_session}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Overload Threshold</p>
                  <p className="text-gray-200 text-xl font-bold">{result.overload_threshold}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Overloaded Sessions</p>
                  <p className="text-red-200 text-xl font-bold">{result.overloaded_sessions}</p>
                </div>
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg px-4 py-3">
                  <p className="text-orange-400 text-xs font-medium uppercase tracking-wide mb-1">Perf Degradation Rate</p>
                  <p className="text-orange-200 text-xl font-bold">{result.performance_degradation_rate}%</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Error Rate (Overloaded)</p>
                  <p className="text-red-200 text-xl font-bold">{result.error_rate_under_overload}%</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Error Rate (Normal)</p>
                  <p className="text-green-200 text-xl font-bold">{result.error_rate_normal}%</p>
                </div>
              </div>
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg px-4 py-3">
                <p className="text-indigo-400 text-xs font-medium uppercase tracking-wide mb-1">Optimal Instruction Range</p>
                <p className="text-indigo-200 text-sm font-semibold">{result.optimal_instruction_range.min} – {result.optimal_instruction_range.max} instructions</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Trend</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${trendBadge(result.trend)}`}>
                    {result.trend}
                  </span>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Sessions</p>
                  <p className="text-gray-200 text-xl font-bold">{result.total_sessions}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Analysis Time</p>
                  <p className="text-gray-400 text-xs">{new Date(result.analysis_timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Most Overloaded Agent</p>
                  <p className="text-red-200 text-sm font-semibold truncate">{result.most_overloaded_agent || '—'}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Least Overloaded Agent</p>
                  <p className="text-green-200 text-sm font-semibold truncate">{result.least_overloaded_agent || '—'}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
