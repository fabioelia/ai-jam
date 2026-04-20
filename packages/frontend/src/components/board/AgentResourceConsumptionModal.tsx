import React from 'react';
import { AgentResourceConsumptionReport } from '../../api/mutations.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AgentResourceConsumptionReport | null;
  loading: boolean;
}

const TIER_STYLES: Record<string, string> = {
  efficient: 'bg-cyan-500 text-white',
  normal: 'bg-blue-500 text-white',
  heavy: 'bg-amber-500 text-white',
  excessive: 'bg-red-500 text-white',
};

export default function AgentResourceConsumptionModal({ isOpen, onClose, data, loading }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">AI Agent Resource Consumption Analyzer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {loading && <div className="p-6 text-center text-gray-400">Analyzing...</div>}
        {!loading && !data && <div className="p-6 text-center text-gray-400">No data available.</div>}
        {!loading && data && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Agents</div>
                <div className="text-2xl font-bold text-white">{data.summary.totalAgents}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Tokens Used</div>
                <div className="text-2xl font-bold text-cyan-400">{data.summary.totalTokensUsed.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Avg Tokens/Agent</div>
                <div className="text-2xl font-bold text-cyan-400">{data.summary.avgTokensPerAgent.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Avg API Calls/Task</div>
                <div className="text-2xl font-bold text-cyan-400">{data.summary.avgApiCallsPerTask}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">Agent</th>
                  <th className="text-right py-2">Tasks</th>
                  <th className="text-right py-2">Total Tokens</th>
                  <th className="text-right py-2">API Calls</th>
                  <th className="text-right py-2">Avg Tokens/Task</th>
                  <th className="text-left py-2 pl-4">Score</th>
                  <th className="text-left py-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map(agent => (
                  <tr key={agent.agentId} className="border-b border-gray-800">
                    <td className="py-2 text-white">{agent.agentName}</td>
                    <td className="py-2 text-right text-gray-300">{agent.totalTasks}</td>
                    <td className="py-2 text-right text-gray-300">{agent.totalTokensUsed.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-300">{agent.totalApiCalls}</td>
                    <td className="py-2 text-right text-gray-300">{agent.avgTokensPerTask.toLocaleString()}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div className="h-2 bg-cyan-500 rounded-full" style={{ width: `${agent.consumptionScore}%` }} />
                        </div>
                        <span className="text-gray-300">{agent.consumptionScore}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_STYLES[agent.consumptionTier]}`}>
                        {agent.consumptionTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data.insights?.length > 0 || data.recommendations?.length > 0) && (
              <div className="bg-cyan-900/20 border border-cyan-800 rounded-lg p-4">
                <h3 className="text-cyan-400 font-medium mb-2">Insights & Recommendations</h3>
                {data.insights?.map((insight, i) => (
                  <p key={i} className="text-gray-300 text-sm">• {insight}</p>
                ))}
                {data.recommendations?.map((rec, i) => (
                  <p key={`rec-${i}`} className="text-gray-400 text-sm">→ {rec}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
