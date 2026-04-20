import React from 'react';
import { WorkloadFairnessReport, AgentFairnessMetrics } from '../../api/mutations.js';

interface Props {
  result: WorkloadFairnessReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#8b5cf6' : score >= 50 ? '#a78bfa' : score >= 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#374151" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{score}</text>
      </svg>
      <span className="text-xs text-gray-400">Fairness Score</span>
    </div>
  );
}

const STATUS_STYLES = {
  overloaded: { badge: 'bg-red-900/50 text-red-300 border border-red-700/50', row: 'bg-red-900/10' },
  balanced: { badge: 'bg-green-900/50 text-green-300 border border-green-700/50', row: '' },
  underloaded: { badge: 'bg-amber-900/50 text-amber-300 border border-amber-700/50', row: 'bg-amber-900/10' },
};

function AgentRow({ agent }: { agent: AgentFairnessMetrics }) {
  const styles = STATUS_STYLES[agent.status];
  return (
    <div className={`rounded-lg p-3 flex items-center gap-3 ${styles.row || 'bg-gray-800'}`}>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-white text-sm truncate block">{agent.agentPersona}</span>
        <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
          <span>Active: <span className="text-gray-200">{agent.activeTickets}</span></span>
          <span>Done 7d: <span className="text-gray-200">{agent.completedLast7d}</span></span>
          <span>Share: <span className="text-gray-200">{agent.workloadShare.toFixed(1)}%</span></span>
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
        {agent.status}
      </span>
    </div>
  );
}

function SummaryBar({ agents }: { agents: AgentFairnessMetrics[] }) {
  const overloaded = agents.filter(a => a.status === 'overloaded').length;
  const balanced = agents.filter(a => a.status === 'balanced').length;
  const underloaded = agents.filter(a => a.status === 'underloaded').length;
  const total = agents.length;
  if (total === 0) return null;
  return (
    <div className="flex gap-3 text-xs">
      {overloaded > 0 && <span className="text-red-400">{overloaded} overloaded</span>}
      {balanced > 0 && <span className="text-green-400">{balanced} balanced</span>}
      {underloaded > 0 && <span className="text-amber-400">{underloaded} underloaded</span>}
    </div>
  );
}

export default function AgentWorkloadFairnessModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Workload Fairness Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.agents.length} agents · {result.totalActiveTickets} active tickets
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
              <svg className="w-8 h-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing workload fairness...</span>
            </div>
          )}

          {!loading && result && (
            <>
              <div className="flex items-center gap-6">
                <ScoreRing score={result.fairnessScore} />
                <div className="flex-1 space-y-2">
                  <SummaryBar agents={result.agents} />
                  <p className="text-sm text-gray-300 italic">{result.summary}</p>
                </div>
              </div>

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No agent data — assign tickets to agents to track workload fairness.
                </div>
              ) : (
                <div className="space-y-2">
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
