import React from 'react';
import { AgentOutputConsistencyRateReport } from '../../api/mutations.js';

interface Props {
  report: AgentOutputConsistencyRateReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentOutputConsistencyRateAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Output Consistency Rate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing output consistency rate...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-teal-400">{report.consistency_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Consistency Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-teal-300">{report.structural_variance_score.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Structural Variance</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{report.consistent_outputs}</div>
                  <div className="text-xs text-gray-400 mt-1">Consistent</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.inconsistent_outputs}</div>
                  <div className="text-xs text-gray-400 mt-1">Inconsistent</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.total_output_pairs}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Pairs</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Consistency Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Format Consistency Rate</span>
                    <span className="text-teal-400">{report.format_consistency_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tone Consistency Rate</span>
                    <span className="text-teal-300">{report.tone_consistency_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Output Length Variance</span>
                    <span className="text-yellow-400">{report.avg_output_length_variance.toFixed(1)}%</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Most Inconsistent Task Types</h3>
                <div className="space-y-1">
                  {report.most_inconsistent_task_types.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-teal-400 font-mono">{i + 1}.</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Highest Consistency Agent</span>
                    <span className="text-teal-400 font-mono text-xs">{report.highest_consistency_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lowest Consistency Agent</span>
                    <span className="text-yellow-400 font-mono text-xs">{report.lowest_consistency_agent}</span>
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
