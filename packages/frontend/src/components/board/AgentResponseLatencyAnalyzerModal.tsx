import React from 'react';
import { AgentResponseLatencyAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentResponseLatencyAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function trendBadge(trend: string) {
  if (trend === 'improving') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (trend === 'stable') return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function trendArrow(trend: string) {
  if (trend === 'improving') return '↑';
  if (trend === 'stable') return '→';
  return '↓';
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AgentResponseLatencyAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Response Latency Analyzer
            {result && (
              <span className="text-sm font-normal text-blue-400/80 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing response latency...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No response latency data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Latency</p>
                  <p className="text-blue-200 text-2xl font-bold">{formatLatency(result.avg_latency_ms)}</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Total Sessions</p>
                  <p className="text-white text-2xl font-bold">{result.total_sessions}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Fast Rate</p>
                  <p className="text-green-200 text-2xl font-bold">{result.fast_rate}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Trend</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${trendBadge(result.trend)}`}>
                    {trendArrow(result.trend)} {result.trend}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-3">Latency Distribution</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Fast (<1s)', rate: result.fast_rate, color: 'bg-green-400' },
                    { label: 'Normal (1–5s)', rate: result.normal_rate, color: 'bg-blue-400' },
                    { label: 'Slow (5–30s)', rate: result.slow_rate, color: 'bg-yellow-400' },
                    { label: 'Very Slow (>30s)', rate: result.very_slow_rate, color: 'bg-red-400' },
                  ].map(({ label, rate, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs w-32">{label}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-gray-300 text-xs w-10 text-right">{rate}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Avg Latency</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Sessions</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Fast</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Normal</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Slow</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Very Slow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentId}</td>
                        <td className="py-3 pr-4 text-blue-300 font-mono">{formatLatency(m.avgLatencyMs)}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.totalSessions}</td>
                        <td className="py-3 pr-4 text-green-400">{m.fastSessions}</td>
                        <td className="py-3 pr-4 text-blue-400">{m.normalSessions}</td>
                        <td className="py-3 pr-4 text-yellow-400">{m.slowSessions}</td>
                        <td className="py-3 text-red-400">{m.verySlowSessions}</td>
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
