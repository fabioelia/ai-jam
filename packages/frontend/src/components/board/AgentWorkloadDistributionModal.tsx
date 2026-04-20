import React from 'react';
import { AgentWorkloadDistributionReport, AgentWorkloadMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentWorkloadDistributionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const RISK_BADGE_STYLES: Record<AgentWorkloadMetrics['overloadRisk'], string> = {
  critical: 'bg-red-600/20 text-red-400 border border-red-600/50',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/50',
  moderate: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
  low: 'bg-green-500/20 text-green-400 border border-green-500/50',
};

function SummaryCards({ result }: { result: AgentWorkloadDistributionReport }) {
  const cards = [
    { label: 'Total Project Tickets', value: result.totalProjectTickets.toString(), color: 'text-violet-400' },
    { label: 'Most Loaded Agent', value: result.mostLoadedAgent ?? '—', color: 'text-red-400' },
    { label: 'Least Loaded Agent', value: result.leastLoadedAgent ?? '—', color: 'text-green-400' },
    {
      label: 'Workload Gini Coefficient',
      value: result.workloadGiniCoefficient.toFixed(3),
      color: 'text-white',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-base font-bold ${color} truncate`}>{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function AgentTable({ agents }: { agents: AgentWorkloadMetrics[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
            <th className="pb-2 pr-4 font-medium">Agent</th>
            <th className="pb-2 pr-4 font-medium text-right">Sessions</th>
            <th className="pb-2 pr-4 font-medium text-right">Tickets</th>
            <th className="pb-2 pr-4 font-medium text-right">Avg/Session</th>
            <th className="pb-2 pr-4 font-medium text-right">Share %</th>
            <th className="pb-2 pr-4 font-medium">Share Bar</th>
            <th className="pb-2 font-medium">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {agents.map((agent) => (
            <tr key={agent.personaId} className="text-gray-300">
              <td className="py-2 pr-4 font-medium text-white truncate max-w-[120px]">{agent.personaId}</td>
              <td className="py-2 pr-4 text-right font-mono">{agent.totalSessions}</td>
              <td className="py-2 pr-4 text-right font-mono">{agent.totalTickets}</td>
              <td className="py-2 pr-4 text-right font-mono">
                {agent.totalSessions > 0 ? (agent.totalTickets / agent.totalSessions).toFixed(1) : '—'}
              </td>
              <td className="py-2 pr-4 text-right font-mono">{agent.workloadShare.toFixed(1)}</td>
              <td className="py-2 pr-4">
                <div className="w-24 bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-violet-500 h-2 rounded-full"
                    style={{ width: `${Math.min(agent.workloadShare, 100)}%` }}
                  />
                </div>
              </td>
              <td className="py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_BADGE_STYLES[agent.overloadRisk]}`}>
                  {agent.overloadRisk}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIAnalysis({ aiSummary, aiRecommendations }: { aiSummary: string; aiRecommendations: string[] }) {
  return (
    <div className="bg-gradient-to-br from-violet-900/30 to-gray-800 rounded-lg p-4 space-y-3 border border-violet-700/30">
      <h3 className="text-sm font-medium text-violet-300">AI Analysis</h3>
      <p className="text-sm text-gray-300">{aiSummary}</p>
      {aiRecommendations.length > 0 && (
        <ul className="space-y-1 list-disc list-inside text-sm text-gray-400">
          {aiRecommendations.map((rec, i) => (
            <li key={i}>{rec}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AgentWorkloadDistributionModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-violet-800/50">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Workload Distribution</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.agents.length} agent{result.agents.length !== 1 ? 's' : ''} analyzed
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
              <span className="text-gray-400 text-sm">Analyzing workload distribution...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent workload data available for this project
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              <SummaryCards result={result} />

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Agents by Workload</h3>
                <AgentTable agents={result.agents} />
              </div>

              <AIAnalysis aiSummary={result.aiSummary} aiRecommendations={result.aiRecommendations} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
