import React from 'react';
import { GoalAlignmentReport, AgentGoalAlignment } from '../../api/mutations.js';

interface Props {
  result: GoalAlignmentReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const CLASSIFICATION_STYLES = {
  aligned: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50',
  partial: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  drifted: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

const RING_COLOR = {
  aligned: 'text-emerald-400',
  partial: 'text-amber-400',
  drifted: 'text-red-400',
};

function ScoreRing({ score, classification }: { score: number; classification: AgentGoalAlignment['classification'] }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#374151" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all ${RING_COLOR[classification]}`}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${RING_COLOR[classification]}`}>
        {score}%
      </span>
    </div>
  );
}

function StatsBar({ result }: { result: GoalAlignmentReport }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Agents', value: result.summary.totalAgents, color: 'text-cyan-400' },
        { label: 'Avg Alignment', value: `${result.summary.avgAlignmentScore}%`, color: 'text-white' },
        { label: 'Drifted', value: result.summary.driftedAgents, color: result.summary.driftedAgents > 0 ? 'text-red-400' : 'text-white' },
        { label: 'Most Aligned', value: result.summary.mostAlignedAgent ?? '—', color: 'text-emerald-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-base font-bold ${color} truncate`}>{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentGoalAlignment }) {
  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-lg p-3">
      <ScoreRing score={agent.alignmentScore} classification={agent.classification} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">{agent.agentPersona}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLASSIFICATION_STYLES[agent.classification]}`}>
            {agent.classification}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {agent.tasksCompleted} done · {agent.tasksInScope} in-scope · {agent.tasksOutOfScope} out-of-scope · drift {Math.round(agent.driftRate * 100)}%
        </div>
      </div>
    </div>
  );
}

export default function AgentGoalAlignmentModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Goal Alignment Checker</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.summary.totalAgents} agent{result.summary.totalAgents !== 1 ? 's' : ''} analyzed
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
              <svg className="w-8 h-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing goal alignment...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent goal alignment data available for this project
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              <StatsBar result={result} />

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Agents by Alignment Score</h3>
                <div className="space-y-2">
                  {result.agents.map((agent) => (
                    <AgentRow key={agent.agentPersona} agent={agent} />
                  ))}
                </div>
              </div>

              {result.aiSummary && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">AI Analysis</h3>
                  <p className="text-sm text-gray-300">{result.aiSummary}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
