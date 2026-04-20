import React from 'react';
import { AgentWorkflowTransitionReport } from '../../api/mutations.js';

interface Props {
  data: AgentWorkflowTransitionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<string, string> = {
  fluid: 'bg-sky-500 text-white',
  steady: 'bg-green-500 text-white',
  sluggish: 'bg-yellow-500 text-white',
  blocked: 'bg-red-500 text-white',
};

export default function AgentWorkflowTransitionModal({ data, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl p-12 flex items-center justify-center">
          <svg className="w-8 h-8 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-gray-400">Analyzing workflow transitions...</span>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">AI Agent Workflow State Transition Analyzer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Agents</div>
              <div className="text-2xl font-bold text-white">{data.summary.totalAgents}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Avg Transition Time (hrs)</div>
              <div className="text-2xl font-bold text-sky-400">{data.summary.avgTransitionTimeHours}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Stalled Tickets</div>
              <div className={`text-2xl font-bold ${data.summary.stalledTotal > 0 ? 'text-red-400' : 'text-white'}`}>
                {data.summary.stalledTotal}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Fluid Agents</div>
              <div className="text-2xl font-bold text-sky-400">{data.summary.fluidAgents}</div>
            </div>
          </div>

          {/* State Stats Table */}
          {data.stateStats.length > 0 && (
            <div>
              <h3 className="text-sky-400 font-medium mb-3">Workflow State Statistics</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">State</th>
                    <th className="text-right py-2">Tickets</th>
                    <th className="text-right py-2">Avg Duration (h)</th>
                    <th className="text-right py-2">Stalled</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stateStats.map((s) => (
                    <tr key={s.state} className="border-b border-gray-800">
                      <td className="py-2 text-white capitalize">{s.state.replace('_', ' ')}</td>
                      <td className="py-2 text-right text-gray-300">{s.ticketCount}</td>
                      <td className="py-2 text-right text-gray-300">{s.avgDurationHours}</td>
                      <td className={`py-2 text-right ${s.stalledCount > 0 ? 'text-red-400' : 'text-gray-300'}`}>
                        {s.stalledCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Agent Table */}
          {data.agents.length > 0 && (
            <div>
              <h3 className="text-sky-400 font-medium mb-3">Agent Transition Efficiency</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2">Agent</th>
                    <th className="text-left py-2">Tier</th>
                    <th className="text-left py-2 pl-4">Score</th>
                    <th className="text-right py-2">Total Transitions</th>
                    <th className="text-right py-2">Avg Time (h)</th>
                    <th className="text-right py-2">Stalled</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map((agent) => (
                    <tr key={agent.agentId} className="border-b border-gray-800">
                      <td className="py-2 text-white">{agent.agentName}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_STYLES[agent.efficiencyTier]}`}>
                          {agent.efficiencyTier}
                        </span>
                      </td>
                      <td className="py-2 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 bg-sky-500 rounded-full"
                              style={{ width: `${agent.transitionEfficiencyScore}%` }}
                            />
                          </div>
                          <span className="text-gray-300">{agent.transitionEfficiencyScore}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-300">{agent.totalTransitions}</td>
                      <td className="py-2 text-right text-gray-300">{agent.avgTransitionTimeHours}</td>
                      <td className={`py-2 text-right ${agent.stalledTickets > 0 ? 'text-red-400' : 'text-gray-300'}`}>
                        {agent.stalledTickets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AI Analysis */}
          {(data.insights?.length > 0 || data.recommendations?.length > 0) && (
            <div className="bg-sky-500/20 border border-sky-800 rounded-lg p-4">
              <h3 className="text-sky-400 font-medium mb-2">Insights & Recommendations</h3>
              {data.insights?.map((insight, i) => (
                <p key={i} className="text-gray-300 text-sm">• {insight}</p>
              ))}
              {data.recommendations?.map((rec, i) => (
                <p key={`rec-${i}`} className="text-gray-400 text-sm">→ {rec}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
