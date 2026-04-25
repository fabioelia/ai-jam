import type { AgentContextSwitchCostReport } from '../../api/mutations.js';

interface AgentContextSwitchCostModalProps {
  projectId: string;
  result: AgentContextSwitchCostReport | null;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'high_cost': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'moderate_cost': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'low_cost': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'flexible': return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
  }
}

function costBarClass(tier: string): string {
  switch (tier) {
    case 'high_cost': return 'bg-red-500';
    case 'moderate_cost': return 'bg-orange-500';
    case 'low_cost': return 'bg-green-500';
    case 'flexible': return 'bg-teal-500';
    default: return 'bg-gray-500';
  }
}

function getRecommendation(tier: string): string {
  switch (tier) {
    case 'high_cost': return 'Batch same-priority tasks';
    case 'moderate_cost': return 'Reduce priority switching';
    case 'low_cost': return 'On track';
    case 'flexible': return 'Ideal for cross-category work';
    default: return 'Need more data';
  }
}

function getSwitchRateLabel(switchRate: number): string {
  if (switchRate >= 70) return 'High Switching';
  if (switchRate >= 40) return 'Moderate';
  return 'Low Switching';
}

export default function AgentContextSwitchCostModal({
  result,
  loading,
  onClose,
}: AgentContextSwitchCostModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            AI Agent Context Switch Cost
            {result && (
              <span className="text-sm font-normal text-teal-400/80 border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 rounded-full">
                avg cost {result.summary.avgSwitchCost}%
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing context switch costs...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <p className="text-gray-400 text-sm">No context switch data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-teal-200 text-xl font-bold">{result.summary.totalAgents}</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Switch Cost</p>
                  <p className="text-teal-200 text-xl font-bold">{result.summary.avgSwitchCost}%</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">High Cost Agents</p>
                  <p className="text-teal-200 text-xl font-bold">{result.summary.highCostCount}</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Flexible Agents</p>
                  <p className="text-teal-200 text-xl font-bold">{result.summary.flexibleCount}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-center">Sessions</th>
                      <th className="px-4 py-3 text-center">Switch Rate</th>
                      <th className="px-4 py-3 text-center">Switches</th>
                      <th className="px-4 py-3 text-center">Switch Cost %</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{agent.agentRole}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalSessions}</td>
                        <td className="px-4 py-3 text-center text-gray-300 text-xs">
                          {getSwitchRateLabel(agent.switchRate)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.switchCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${costBarClass(agent.tier)}`}
                                style={{ width: `${Math.min(100, Math.max(0, Math.abs(agent.switchCostPct)))}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs ${agent.switchCostPct > 0 ? 'text-red-300' : 'text-teal-300'}`}>
                              {agent.switchCostPct > 0 ? '+' : ''}{agent.switchCostPct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tierBadgeClass(agent.tier)}`}>
                            {agent.tier.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs">
                          {getRecommendation(agent.tier)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gradient-to-r from-teal-900/20 to-teal-800/10 border border-teal-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-teal-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-teal-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                {result.aiRecommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-teal-100/70 text-sm flex items-start gap-2">
                        <span className="text-teal-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
