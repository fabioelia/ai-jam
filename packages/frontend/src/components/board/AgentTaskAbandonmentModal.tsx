import React from 'react';
import { AgentAbandonmentReport, AgentAbandonmentMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentAbandonmentReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const RISK_STYLES: Record<AgentAbandonmentMetrics['riskLevel'], string> = {
  critical: 'bg-red-900/50 text-red-300 border border-red-700/50',
  high: 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  moderate: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  low: 'bg-green-900/50 text-green-300 border border-green-700/50',
};

function StatsBar({ result }: { result: AgentAbandonmentReport }) {
  const avgPct = (result.summary.avgAbandonmentRate * 100).toFixed(1);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Agents', value: result.summary.totalAgents, color: 'text-cyan-400' },
        { label: 'Avg Abandonment', value: `${avgPct}%`, color: result.summary.avgAbandonmentRate >= 0.25 ? 'text-orange-400' : 'text-white' },
        { label: 'High Risk', value: result.summary.highRiskAgents, color: result.summary.highRiskAgents > 0 ? 'text-red-400' : 'text-white' },
        { label: 'Most Reliable', value: result.summary.mostReliableAgent ?? '—', color: 'text-green-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-base font-bold ${color} truncate`}>{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentAbandonmentMetrics }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-sm font-medium text-white">{agent.agentPersona}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_STYLES[agent.riskLevel]}`}>
          {agent.riskLevel}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{(agent.abandonmentRate * 100).toFixed(1)}% abandoned</span>
      </div>
      <div className="text-xs text-gray-400 mb-1">
        {agent.totalTasks} total · {agent.abandonedTasks} abandoned · {agent.completedTasks} done
        {agent.avgStuckDuration > 0 && ` · avg stuck ${agent.avgStuckDuration}h`}
      </div>
      <div className="text-xs text-gray-500 italic">{agent.recommendation}</div>
    </div>
  );
}

export default function AgentTaskAbandonmentModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Agent Task Abandonment Analyzer</h2>
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
              <svg className="w-8 h-8 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing task abandonment patterns...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent task abandonment data available for this project
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              <StatsBar result={result} />

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Agents by Abandonment Rate</h3>
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
