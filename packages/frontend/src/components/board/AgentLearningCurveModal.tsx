import React from 'react';
import { LearningCurveReport } from '../../api/mutations.js';

interface Props {
  report: LearningCurveReport;
  onClose: () => void;
}

const TREND_STYLES: Record<'improving' | 'stable' | 'declining', string> = {
  improving: 'bg-green-900/50 text-green-300 border border-green-700/50',
  stable: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  declining: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

export default function AgentLearningCurveModal({ report, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Learning Curves</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {report.agents.length} agent{report.agents.length !== 1 ? 's' : ''} · {report.windowWeeks}-week analysis window
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {report.agents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              No agent performance data available
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 pr-4 font-medium">Agent</th>
                  <th className="pb-3 pr-4 font-medium">Current Score</th>
                  <th className="pb-3 pr-4 font-medium">Peak Score</th>
                  <th className="pb-3 pr-4 font-medium">Trend</th>
                  <th className="pb-3 pr-4 font-medium">Stagnation Weeks</th>
                  <th className="pb-3 font-medium">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {report.agents.map(agent => (
                  <tr key={agent.agentPersona} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-white">{agent.agentPersona}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200">{agent.currentQualityScore.toFixed(1)}</span>
                        <div className="w-16 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(100, agent.currentQualityScore)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-gray-300">{agent.peakQualityScore.toFixed(1)}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TREND_STYLES[agent.trend]}`}>
                        {agent.trend}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-300">{agent.stagnationWeeks}</td>
                    <td className="py-3 text-gray-400 text-xs max-w-xs">{agent.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 shrink-0 text-xs text-gray-500">
          Generated {new Date(report.generatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
