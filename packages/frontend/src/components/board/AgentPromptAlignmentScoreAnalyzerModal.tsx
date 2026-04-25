import React from 'react';
import { AgentPromptAlignmentScoreReport } from '../../api/mutations.js';

interface Props {
  report: AgentPromptAlignmentScoreReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentPromptAlignmentScoreAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Prompt Alignment Score</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing prompt alignment score...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-amber-400">{report.alignment_score}</div>
                  <div className="text-sm text-gray-400 mt-1">Alignment Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-amber-300">{report.format_compliance_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Format Compliance</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-400">{report.high_alignment_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">High Alignment</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.low_alignment_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Low Alignment</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.total_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Alignment Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Topic Drift Rate</span>
                    <span className="text-red-400">{report.topic_drift_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Scope Overshoot Rate</span>
                    <span className="text-orange-400">{report.scope_overshoot_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Scope Undershoot Rate</span>
                    <span className="text-yellow-400">{report.scope_undershoot_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Intent Mismatch Rate</span>
                    <span className="text-amber-400">{report.intent_mismatch_rate.toFixed(1)}%</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Misalignment Patterns</h3>
                <div className="space-y-1">
                  {report.top_misalignment_patterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-amber-400 font-mono">{i + 1}.</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Aligned Agent</span>
                    <span className="text-amber-400 font-mono text-xs">{report.best_aligned_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Worst Aligned Agent</span>
                    <span className="text-yellow-400 font-mono text-xs">{report.worst_aligned_agent}</span>
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
