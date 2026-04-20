import React from 'react';
import { AgentTaskVelocityReport, AgentVelocityMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentTaskVelocityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const RATING_STYLES: Record<AgentVelocityMetrics['rating'], { badge: string; row: string }> = {
  fast: { badge: 'bg-green-900/50 text-green-300 border border-green-700/50', row: 'bg-green-900/5' },
  normal: { badge: 'bg-blue-900/50 text-blue-300 border border-blue-700/50', row: '' },
  slow: { badge: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50', row: 'bg-yellow-900/5' },
  bottleneck: { badge: 'bg-red-900/50 text-red-300 border border-red-700/50', row: 'bg-red-900/10' },
};

export default function AgentTaskVelocityModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Task Velocity Tracker</h2>
            {result && <p className="text-sm text-gray-400 mt-0.5">{result.totalAgents} agents · {result.bottleneckAgents} bottlenecks</p>}
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
              <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing task velocity...</span>
            </div>
          )}

          {!loading && result && (
            <>
              {result.fastestAgent && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                    <div className="text-xs text-gray-400">Fastest</div>
                    <div className="text-sm font-medium text-green-300 truncate">{result.fastestAgent}</div>
                  </div>
                  {result.slowestAgent && result.slowestAgent !== result.fastestAgent && (
                    <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
                      <div className="text-xs text-gray-400">Slowest</div>
                      <div className="text-sm font-medium text-red-300 truncate">{result.slowestAgent}</div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">No velocity data available.</div>
              ) : (
                <div className="space-y-2">
                  {result.agents.map(agent => {
                    const styles = RATING_STYLES[agent.rating];
                    return (
                      <div key={agent.agentPersona} className={`rounded-lg p-3 ${styles.row || 'bg-gray-800'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm truncate">{agent.agentPersona}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${styles.badge}`}>{agent.rating}</span>
                            </div>
                            <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                              <span>Score: <span className="text-gray-200">{agent.velocityScore}</span></span>
                              <span>Cycle: <span className="text-gray-200">{agent.avgTotalCycleHours.toFixed(1)}h</span></span>
                              <span>Done: <span className="text-gray-200">{agent.completedTickets}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!loading && !result && <div className="text-center py-12 text-gray-500 text-sm">No data available.</div>}
        </div>
      </div>
    </div>
  );
}
