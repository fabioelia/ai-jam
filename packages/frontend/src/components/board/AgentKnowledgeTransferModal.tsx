import React from 'react';
import { AgentKnowledgeTransferReport, AgentKnowledgeTransferMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentKnowledgeTransferReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<string, string> = {
  excellent: 'bg-emerald-500 text-white',
  good: 'bg-green-500 text-white',
  adequate: 'bg-yellow-500 text-white',
  poor: 'bg-red-500 text-white',
};

export default function AgentKnowledgeTransferModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl p-12 flex items-center justify-center">
          <svg className="w-8 h-8 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-gray-400">Analyzing agent knowledge transfer...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl p-12 text-center">
          <p className="text-gray-400">No data available. Run the analysis to see results.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { summary, agents, insights, recommendations, aiSummary, aiRecommendations } = result;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">AI Agent Knowledge Transfer Efficiency Analyzer</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Agents</div>
              <div className="text-2xl font-bold text-emerald-400">{summary.totalAgents}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Avg Transfer Rate</div>
              <div className="text-2xl font-bold text-emerald-400">{summary.avgKnowledgeTransferRate}%</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Top Transfer Agent</div>
              <div className="text-xl font-bold text-emerald-400 truncate">{summary.topTransferAgent || '—'}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Knowledge Loss Risk</div>
              <div className="text-2xl font-bold text-red-400">{summary.knowledgeLossRiskCount}</div>
            </div>
          </div>

          {/* Agent Table */}
          {agents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">Agent</th>
                    <th className="text-left py-2">Tier</th>
                    <th className="text-left py-2 pl-4">Retention Score</th>
                    <th className="text-right py-2">Transfer Rate</th>
                    <th className="text-right py-2">Handoff Note Length</th>
                    <th className="text-right py-2">Received Knowledge</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent: AgentKnowledgeTransferMetrics) => (
                    <tr key={agent.agentId} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 text-white">{agent.agentName}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_STYLES[agent.transferEfficiencyTier]}`}>
                          {agent.transferEfficiencyTier}
                        </span>
                      </td>
                      <td className="py-2 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(agent.knowledgeRetentionScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-gray-300">{agent.knowledgeRetentionScore}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-300">{agent.knowledgeTransferRate}%</td>
                      <td className="py-2 text-right text-gray-300">{agent.avgHandoffNoteLength}</td>
                      <td className="py-2 text-right text-gray-300">{agent.receivedKnowledgeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No agent data available for this project.</div>
          )}

          {/* AI Analysis */}
          <div className="bg-emerald-500/20 border border-emerald-800 rounded-lg p-4 bg-gradient-to-br from-emerald-900/30 to-gray-900/50">
            <h3 className="text-emerald-400 font-medium mb-3">AI Analysis</h3>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="mb-3">
                <h4 className="text-emerald-400 text-sm font-medium mb-1">Insights</h4>
                {insights.map((insight, i) => (
                  <p key={i} className="text-gray-300 text-sm mb-1">• {insight}</p>
                ))}
              </div>
            )}

            {/* AI Summary */}
            {aiSummary && (
              <div className="mb-3">
                <h4 className="text-emerald-400 text-sm font-medium mb-1">Summary</h4>
                <p className="text-gray-300 text-sm">{aiSummary}</p>
              </div>
            )}

            {/* Recommendations */}
            {(aiRecommendations && aiRecommendations.length > 0 ? aiRecommendations : recommendations).length > 0 && (
              <div>
                <h4 className="text-emerald-400 text-sm font-medium mb-1">Recommendations</h4>
                {(aiRecommendations && aiRecommendations.length > 0 ? aiRecommendations : recommendations).map((rec, i) => (
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
