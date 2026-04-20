import React from 'react';
import { AgentErrorRateReport, AgentErrorMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentErrorRateReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
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
      <span className="text-xs text-gray-400">Reliability</span>
    </div>
  );
}

const SEVERITY_STYLES = {
  critical: { badge: 'bg-red-900/50 text-red-300 border border-red-700/50', row: 'bg-red-900/10' },
  high: { badge: 'bg-rose-900/50 text-rose-300 border border-rose-700/50', row: 'bg-rose-900/10' },
  moderate: { badge: 'bg-amber-900/50 text-amber-300 border border-amber-700/50', row: 'bg-amber-900/10' },
  low: { badge: 'bg-green-900/50 text-green-300 border border-green-700/50', row: '' },
};

function AgentRow({ agent }: { agent: AgentErrorMetrics }) {
  const styles = SEVERITY_STYLES[agent.severity];
  return (
    <div className={`rounded-lg p-3 flex flex-col gap-2 ${styles.row || 'bg-gray-800'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-white text-sm truncate block">{agent.agentPersona}</span>
          <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
            <span>Total: <span className="text-gray-200">{agent.totalTasks}</span></span>
            <span>Failed: <span className="text-gray-200">{agent.failedTasks}</span></span>
            <span>Retried: <span className="text-gray-200">{agent.retriedTasks}</span></span>
            <span>Score: <span className="text-gray-200">{agent.reliabilityScore}</span></span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
            {agent.severity}
          </span>
          <span className="text-xs text-gray-400">
            {(agent.errorRate * 100).toFixed(1)}% error
          </span>
        </div>
      </div>
      {agent.severity !== 'low' && (
        <p className="text-xs text-gray-400 italic">{agent.recommendedAction}</p>
      )}
    </div>
  );
}

function StatsBar({ report }: { report: AgentErrorRateReport }) {
  return (
    <div className="flex gap-4 text-xs flex-wrap">
      <span className="text-gray-400">Agents: <span className="text-white font-medium">{report.summary.totalAgents}</span></span>
      <span className="text-gray-400">Avg Error: <span className="text-white font-medium">{(report.summary.avgErrorRate * 100).toFixed(1)}%</span></span>
      <span className="text-gray-400">High Risk: <span className={report.summary.highRiskAgents > 0 ? 'text-red-400 font-medium' : 'text-white font-medium'}>{report.summary.highRiskAgents}</span></span>
      {report.summary.mostReliableAgent && (
        <span className="text-gray-400">Best: <span className="text-green-400 font-medium">{report.summary.mostReliableAgent}</span></span>
      )}
    </div>
  );
}

export default function AgentErrorRateModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  const avgScore = result && result.agents.length > 0
    ? Math.round(result.agents.reduce((s, a) => s + a.reliabilityScore, 0) / result.agents.length)
    : 100;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Agent Error Rate Tracker</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.agents.length} agents analyzed
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
              <svg className="w-8 h-8 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing agent error rates...</span>
            </div>
          )}

          {!loading && result && (
            <>
              <div className="flex items-center gap-6">
                <ScoreRing score={avgScore} />
                <div className="flex-1 space-y-2">
                  <StatsBar report={result} />
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>
                </div>
              </div>

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No agent error data available for this project
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
