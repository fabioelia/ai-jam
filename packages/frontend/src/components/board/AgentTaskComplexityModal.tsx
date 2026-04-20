import React from 'react';
import { TaskComplexityReport, AgentTaskComplexity } from '../../api/mutations.js';

interface Props {
  result: TaskComplexityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentTaskComplexity['complexityTier'], string> = {
  'very-high': 'bg-red-900/50 text-red-300 border border-red-700/50',
  'high': 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  'medium': 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  'low': 'bg-green-900/50 text-green-300 border border-green-700/50',
};

function StatsBar({ result }: { result: TaskComplexityReport }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Agents', value: result.summary.totalAgentsAnalyzed, color: 'text-cyan-400' },
        { label: 'Avg Complexity', value: result.summary.avgComplexityScore, color: 'text-white' },
        { label: 'Highest Complexity', value: result.summary.highestComplexityAgent ?? '—', color: 'text-red-400' },
        { label: 'Lowest Complexity', value: result.summary.lowestComplexityAgent ?? '—', color: 'text-green-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-base font-bold ${color} truncate`}>{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentTaskComplexity }) {
  return (
    <tr className="border-t border-gray-700">
      <td className="py-2 px-3 text-sm text-white">{agent.personaId}</td>
      <td className="py-2 px-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_STYLES[agent.complexityTier]}`}>
          {agent.complexityTier}
        </span>
      </td>
      <td className="py-2 px-3 text-sm text-white text-right font-mono">{agent.complexityScore}</td>
      <td className="py-2 px-3 text-sm text-gray-300 text-right">{agent.avgTransitionsPerTicket.toFixed(1)}</td>
      <td className="py-2 px-3 text-sm text-gray-300 text-right">{Math.round(agent.reworkRate * 100)}%</td>
      <td className="py-2 px-3 text-sm text-gray-300 text-right">{agent.avgHandoffChainDepth.toFixed(1)}</td>
      <td className="py-2 px-3 text-sm text-gray-300 text-right">{Math.round(agent.epicLinkRate * 100)}%</td>
    </tr>
  );
}

export default function AgentTaskComplexityModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Agent Task Complexity Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.summary.totalAgentsAnalyzed} agent{result.summary.totalAgentsAnalyzed !== 1 ? 's' : ''} analyzed
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
              <span className="text-gray-400 text-sm">Analyzing task complexity...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No task complexity data available for this project
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              <StatsBar result={result} />

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Agents by Complexity Score</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-gray-400">
                        <th className="py-2 px-3">Persona</th>
                        <th className="py-2 px-3">Tier</th>
                        <th className="py-2 px-3 text-right">Score</th>
                        <th className="py-2 px-3 text-right">Avg Transitions</th>
                        <th className="py-2 px-3 text-right">Rework Rate</th>
                        <th className="py-2 px-3 text-right">Chain Depth</th>
                        <th className="py-2 px-3 text-right">Epic Link Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.agents.map((agent) => (
                        <AgentRow key={agent.personaId} agent={agent} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
