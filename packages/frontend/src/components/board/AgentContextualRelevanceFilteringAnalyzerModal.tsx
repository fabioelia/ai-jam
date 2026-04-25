import React from 'react';
import { AgentContextualRelevanceFilteringReport } from '../../api/mutations.js';

interface Props {
  report: AgentContextualRelevanceFilteringReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentContextualRelevanceFilteringAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Contextual Relevance Filtering</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing contextual relevance filtering...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400">{report.relevance_filtering_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Relevance Filtering Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-400">{report.context_overload_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Context Overload Rate</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-emerald-400">{report.high_relevance_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">High Relevance</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{report.low_relevance_sessions}</div>
                  <div className="text-xs text-gray-400 mt-1">Low Relevance</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-orange-400">{report.noise_distraction_count}</div>
                  <div className="text-xs text-gray-400 mt-1">Distracted</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Key Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Sessions</span>
                    <span className="text-white">{report.total_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Relevance Score</span>
                    <span className="text-white">{report.avg_relevance_score.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Irrelevant Context Ratio</span>
                    <span className="text-white">{(report.irrelevant_context_ratio * 100).toFixed(1)}%</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Distraction Patterns</h3>
                <div className="space-y-1">
                  {report.top_distraction_patterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-emerald-400 font-mono">{i + 1}.</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Filtering Agent</span>
                    <span className="text-emerald-400 font-mono text-xs">{report.best_filtering_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Worst Filtering Agent</span>
                    <span className="text-red-400 font-mono text-xs">{report.worst_filtering_agent}</span>
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
