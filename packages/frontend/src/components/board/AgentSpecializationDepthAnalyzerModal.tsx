import React from 'react';
import { AgentSpecializationDepthReport } from '../../api/mutations.js';

interface Props {
  report: AgentSpecializationDepthReport | null;
  loading: boolean;
  onClose: () => void;
}

export function AgentSpecializationDepthAnalyzerModal({ report, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Specialization Depth</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-400 py-8">Analyzing specialization depth...</div>
          )}
          {!loading && !report && (
            <div className="text-center text-gray-400 py-8">No data available.</div>
          )}
          {!loading && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-400">{report.specialization_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-400 mt-1">Specialization Rate</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">{report.avg_specialization_score.toFixed(1)}</div>
                  <div className="text-sm text-gray-400 mt-1">Avg Depth Score</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-300">{report.deep_specialist_count}</div>
                  <div className="text-xs text-gray-400 mt-1">Deep Specialists</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-yellow-400">{report.generalist_count}</div>
                  <div className="text-xs text-gray-400 mt-1">Generalists</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-orange-400">{report.misallocated_count}</div>
                  <div className="text-xs text-gray-400 mt-1">Misallocated</div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Key Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Agents</span>
                    <span className="text-white">{report.total_agents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Domain Concentration Rate</span>
                    <span className="text-white">{report.domain_concentration_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cross-Domain Task Rate</span>
                    <span className="text-white">{report.cross_domain_task_rate.toFixed(1)}%</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-3">Top Specialization Domains</h3>
                <div className="space-y-1">
                  {report.top_specialization_domains.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-gray-400 font-mono">{i + 1}.</span>
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Agent Comparison</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Most Specialized Agent</span>
                    <span className="text-gray-300 font-mono text-xs">{report.most_specialized_agent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Least Specialized Agent</span>
                    <span className="text-yellow-400 font-mono text-xs">{report.least_specialized_agent}</span>
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
