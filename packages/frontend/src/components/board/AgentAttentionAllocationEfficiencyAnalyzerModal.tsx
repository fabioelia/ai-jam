import React from 'react';
import { AgentAttentionAllocationEfficiencyReport } from '../../api/mutations.js';

interface Props {
  report: AgentAttentionAllocationEfficiencyReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentAttentionAllocationEfficiencyAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Attention Allocation Efficiency</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing attention allocation efficiency...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-violet-400">{report.allocation_efficiency_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Allocation Efficiency Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{(report.attention_waste_ratio * 100).toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Attention Waste Ratio</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-violet-400">{report.optimal_attention_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Optimal</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.misallocated_attention_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Misallocated</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-400">{report.total_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Attention Distribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Primary Task Focus Rate</span>
                    <span className="text-violet-400">{report.primary_task_focus_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtask Over-Attention Rate</span>
                    <span className="text-orange-400">{report.subtask_over_attention_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Context Under-Attention Rate</span>
                    <span className="text-yellow-400">{report.context_under_attention_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Allocation Efficiency</span>
                    <span className="text-white">{report.avg_allocation_efficiency.toFixed(1)}</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Misallocation Patterns</h3>
                <div className="space-y-1">
                  {report.top_misallocation_patterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-violet-400 font-mono">{i + 1}.</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Allocation Agent</span>
                    <span className="text-violet-400 font-mono text-xs">{report.best_allocation_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Worst Allocation Agent</span>
                    <span className="text-red-400 font-mono text-xs">{report.worst_allocation_agent}</span>
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
