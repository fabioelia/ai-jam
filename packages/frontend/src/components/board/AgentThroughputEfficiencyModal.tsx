import React from 'react';
import { ThroughputEfficiencyReport, AgentThroughputMetrics } from '../../api/mutations.js';

interface Props {
  result: ThroughputEfficiencyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 75 ? 'bg-teal-500' : score >= 50 ? 'bg-green-500' : score >= 25 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(1)}</span>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentThroughputMetrics }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 w-5">#{agent.rank}</span>
          <span className="font-medium text-white">{agent.agentPersona}</span>
        </div>
        <span className="text-xs text-gray-400">{agent.throughputScore.toFixed(1)} pts</span>
      </div>
      <ScoreBar score={agent.throughputScore} />
      <div className="text-xs text-gray-400 flex gap-4">
        <span>Done: <span className="text-gray-200">{agent.completedTickets}/{agent.totalTickets}</span></span>
        <span>Avg cycle: <span className="text-gray-200">{agent.avgCycleTimeHours}h</span></span>
      </div>
      <p className="text-xs text-gray-500 italic">{agent.recommendation}</p>
    </div>
  );
}

export default function AgentThroughputEfficiencyModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Throughput Efficiency Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.agents.length} agents · avg score {result.avgThroughputScore.toFixed(1)}
                {result.topAgent && ` · top: ${result.topAgent}`}
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
              <span className="text-gray-400 text-sm">Analyzing agent throughput...</span>
            </div>
          )}

          {!loading && result && (
            <>
              {result.topAgent && result.bottomAgent && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-teal-900/30 border border-teal-700/50 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-teal-400 uppercase tracking-wide mb-1">Top Agent</p>
                    <p className="text-white font-medium">{result.topAgent}</p>
                  </div>
                  <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-1">Needs Attention</p>
                    <p className="text-white font-medium">{result.bottomAgent}</p>
                  </div>
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
                  No agent data — assign tickets to agents to track throughput.
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
