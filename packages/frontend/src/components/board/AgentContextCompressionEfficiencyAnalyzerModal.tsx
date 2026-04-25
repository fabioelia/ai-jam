import React from 'react';
import { AgentContextCompressionEfficiencyReport } from '../../api/mutations.js';

interface Props {
  report: AgentContextCompressionEfficiencyReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentContextCompressionEfficiencyAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Context Compression Efficiency</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing context compression efficiency...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{report.efficiency_score}%</div>
                  <div className="text-sm text-gray-400 mt-1">Efficiency Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-300">{report.compression_accuracy_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Compression Accuracy</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{report.efficient_handoffs}</div>
                  <div className="text-xs text-gray-400 mt-1">Efficient</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.inefficient_handoffs}</div>
                  <div className="text-xs text-gray-400 mt-1">Inefficient</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.total_handoffs}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Handoffs</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Compression Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Context Size Ratio</span>
                    <span className="text-red-400">{report.avg_context_size_ratio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Over-Compression Rate</span>
                    <span className="text-yellow-400">{report.over_compression_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Under-Compression Rate</span>
                    <span className="text-orange-400">{report.under_compression_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Tokens Per Handoff</span>
                    <span className="text-white">{report.avg_tokens_per_handoff.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Handoff Success Rate</span>
                    <span className="text-green-400">{report.handoff_success_rate.toFixed(1)}%</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Compression Patterns</h3>
                <div className="space-y-1">
                  {report.top_compression_patterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-red-400 font-mono">{i + 1}.</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Most Efficient Agent</span>
                    <span className="text-red-400 font-mono text-xs">{report.most_efficient_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Least Efficient Agent</span>
                    <span className="text-yellow-400 font-mono text-xs">{report.least_efficient_agent}</span>
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
