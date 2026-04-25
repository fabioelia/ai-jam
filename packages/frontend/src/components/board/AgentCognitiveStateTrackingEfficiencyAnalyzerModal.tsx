import React from 'react';
import { AgentCognitiveStateTrackingEfficiencyReport } from '../../api/mutations.js';

interface Props {
  report: AgentCognitiveStateTrackingEfficiencyReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentCognitiveStateTrackingEfficiencyAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Cognitive State Tracking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing cognitive state tracking efficiency...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">{report.efficiency_score}%</div>
                  <div className="text-sm text-gray-400 mt-1">Efficiency Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-300">{report.avg_efficiency_score.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Avg Efficiency</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{report.high_efficiency_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">High Efficiency</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.low_efficiency_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Low Efficiency</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.total_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">State Tracking Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">State Loss Events</span>
                    <span className="text-red-400">{report.state_loss_events}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Redundant Action Rate</span>
                    <span className="text-yellow-400">{report.redundant_action_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Context Recovery Rate</span>
                    <span className="text-blue-400">{report.context_recovery_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Multi-Step Completion Rate</span>
                    <span className="text-green-400">{report.multi_step_completion_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dependency Tracking Accuracy</span>
                    <span className="text-blue-300">{report.dependency_tracking_accuracy.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Longest Coherent Chain</span>
                    <span className="text-white">{report.longest_coherent_chain}</span>
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
                    <span className="text-gray-400">Most Coherent Agent</span>
                    <span className="text-blue-400 font-mono text-xs">{report.most_coherent_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Least Coherent Agent</span>
                    <span className="text-yellow-400 font-mono text-xs">{report.least_coherent_agent}</span>
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
