import React from 'react';
import { AgentInstructionInterpretationVarianceReport } from '../../api/mutations.js';

interface Props {
  report: AgentInstructionInterpretationVarianceReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentInstructionInterpretationVarianceAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Instruction Interpretation Variance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing instruction interpretation variance...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-cyan-400">{report.variance_score}%</div>
                  <div className="text-sm text-gray-400 mt-1">Variance Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-cyan-300">{report.avg_variance_score.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Avg Variance Score</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{report.consistent_interpretations}</div>
                  <div className="text-xs text-gray-400 mt-1">Consistent</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.inconsistent_interpretations}</div>
                  <div className="text-xs text-gray-400 mt-1">Inconsistent</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.total_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Variance Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Repeated Instruction Groups</span>
                    <span className="text-cyan-400">{report.repeated_instruction_groups}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phrasing Sensitivity Rate</span>
                    <span className="text-cyan-300">{report.phrasing_sensitivity_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Context Noise Sensitivity</span>
                    <span className="text-yellow-400">{report.context_noise_sensitivity.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Interpretation Drift Over Time</span>
                    <span className="text-orange-400">{report.interpretation_drift_over_time.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">High Variance Sessions</span>
                    <span className="text-red-400">{report.high_variance_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Low Variance Sessions</span>
                    <span className="text-green-400">{report.low_variance_sessions}</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Most Consistent Agent</span>
                    <span className="text-cyan-400 font-mono text-xs">{report.most_consistent_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Least Consistent Agent</span>
                    <span className="text-yellow-400 font-mono text-xs">{report.least_consistent_agent}</span>
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
