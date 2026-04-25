import React from 'react';
import { AgentInstructionExecutionLatencyReport } from '../../api/mutations.js';

interface Props {
  report: AgentInstructionExecutionLatencyReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentInstructionExecutionLatencyAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Instruction Execution Latency</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing instruction execution latency...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-400">{report.latency_score}</div>
                  <div className="text-sm text-gray-400 mt-1">Latency Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-orange-300">{report.avg_first_output_latency_ms}ms</div>
                  <div className="text-sm text-gray-400 mt-1">Avg First Output</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{report.fast_start_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Fast Start</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.slow_start_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Slow Start</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.total_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Latency Distribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Parse Time</span>
                    <span className="text-white">{report.avg_instruction_parse_time_ms}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Median Execution Start</span>
                    <span className="text-white">{report.median_execution_start_ms}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">P95 Execution Start</span>
                    <span className="text-orange-400">{report.p95_execution_start_ms}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Disambiguation Delay Rate</span>
                    <span className="text-yellow-400">{report.disambiguation_delay_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Planning Overhead Rate</span>
                    <span className="text-white">{report.planning_overhead_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trend</span>
                    <span className={report.trend === 'improving' ? 'text-green-400' : report.trend === 'degrading' ? 'text-red-400' : 'text-yellow-400'}>
                      {report.trend}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Latency Patterns</h3>
                <div className="space-y-1">
                  {report.top_latency_patterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-orange-400 font-mono">{i + 1}.</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fastest Agent</span>
                    <span className="text-green-400 font-mono text-xs">{report.fastest_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Slowest Agent</span>
                    <span className="text-orange-400 font-mono text-xs">{report.slowest_agent}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-right">
                {new Date(report.analysis_timestamp).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
