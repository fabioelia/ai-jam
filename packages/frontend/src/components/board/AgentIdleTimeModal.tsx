import React from 'react';
import { AgentIdleTimeAnalysis, AgentIdleTimeStats, IdleStatus } from '../../api/mutations.js';

interface Props {
  result: AgentIdleTimeAnalysis | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function statusBadge(status: IdleStatus) {
  switch (status) {
    case 'overloaded': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">Overloaded</span>;
    case 'active': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">Active</span>;
    case 'underutilized': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">Underutilized</span>;
    case 'idle': return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">Idle</span>;
  }
}

function UtilizationBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, rate));
  const color = rate >= 80 ? 'bg-red-500' : rate >= 50 ? 'bg-green-500' : rate >= 20 ? 'bg-yellow-500' : 'bg-gray-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentIdleTimeStats }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{agent.agentPersona}</span>
        {statusBadge(agent.status)}
      </div>
      <UtilizationBar rate={agent.utilizationRate} />
      <div className="text-xs text-gray-400 flex gap-4">
        <span>Avg idle gap: <span className="text-gray-200">{agent.idleGapHours}h</span></span>
        <span>Longest gap: <span className="text-gray-200">{agent.longestIdleGap}h</span></span>
        <span>Tickets: <span className="text-gray-200">{agent.totalTickets}</span></span>
      </div>
    </div>
  );
}

export default function AgentIdleTimeModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Idle Time Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.agents.length} agents · {result.totalIdleRisk} at risk · avg idle {result.avgIdleGapHours}h · overall {result.overallUtilization.toFixed(1)}% utilization
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing agent idle patterns...</span>
            </div>
          )}

          {!loading && result && (
            <>
              {result.totalIdleRisk > 0 && (
                <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-2.5 text-amber-300 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  ⚠ {result.totalIdleRisk} agent(s) idle or underutilized
                </div>
              )}

              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-300 italic">{result.summary}</p>
              </div>

              {result.recommendations.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Recommendations</p>
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300 flex gap-2">
                        <span className="text-teal-400 shrink-0">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No agent data — assign tickets to agents to track idle time.
                </div>
              ) : (
                <div className="space-y-3">
                  {result.agents.map(agent => (
                    <AgentRow key={agent.agentPersona} agent={agent} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
