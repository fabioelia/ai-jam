import React from 'react';
import { AgentSessionQualityReport } from '../../api/mutations.js';

interface Props {
  data: AgentSessionQualityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<string, string> = {
  excellent: 'bg-purple-500 text-white',
  good: 'bg-indigo-500 text-white',
  adequate: 'bg-yellow-500 text-white',
  poor: 'bg-red-500 text-white',
};

export default function AgentSessionQualityModal({ data, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl p-12 flex items-center justify-center">
          <svg className="w-8 h-8 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-gray-400">Analyzing session quality...</span>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">AI Agent Session Quality Scorer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Avg Quality Score</div>
              <div className="text-2xl font-bold text-purple-400">{data.avgQualityScore}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">High Quality Agents</div>
              <div className="text-2xl font-bold text-white">{data.highQualityAgents}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Top Agent</div>
              <div className="text-2xl font-bold text-purple-400 truncate">{data.topAgent ?? '—'}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Agents</div>
              <div className="text-2xl font-bold text-white">{data.agents.length}</div>
            </div>
          </div>

          {/* Agent Table */}
          {data.agents.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">Agent</th>
                  <th className="text-left py-2">Tier</th>
                  <th className="text-left py-2 pl-4">Score</th>
                  <th className="text-right py-2">Output Complete</th>
                  <th className="text-right py-2">Handoff Rate</th>
                  <th className="text-right py-2">Avg Duration (min)</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
                  <tr key={agent.agentId} className="border-b border-gray-800">
                    <td className="py-2 text-white">{agent.agentName}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_STYLES[agent.qualityTier]}`}>
                        {agent.qualityTier}
                      </span>
                    </td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 bg-purple-500 rounded-full"
                            style={{ width: `${agent.avgSessionScore}%` }}
                          />
                        </div>
                        <span className="text-gray-300">{agent.avgSessionScore}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-gray-300">{agent.outputCompleteness}%</td>
                    <td className="py-2 text-right text-gray-300">{agent.handoffRate}%</td>
                    <td className="py-2 text-right text-gray-300">{agent.avgSessionDurationMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* AI Analysis */}
          <div className="bg-purple-500/20 border border-purple-800 rounded-lg p-4">
            <h3 className="text-purple-400 font-medium mb-2">AI Analysis</h3>
            <p className="text-gray-300 text-sm mb-3">{data.aiSummary}</p>
            {data.aiRecommendations.length > 0 && (
              <div>
                <h4 className="text-purple-400 text-sm font-medium mb-1">Recommendations</h4>
                {data.aiRecommendations.map((rec, i) => (
                  <p key={i} className="text-gray-400 text-sm">→ {rec}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
