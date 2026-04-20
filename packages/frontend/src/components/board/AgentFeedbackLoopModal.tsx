import React from 'react';
import { AgentFeedbackLoopMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentFeedbackLoopMetrics[] | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const RESPONSIVENESS_STYLES: Record<AgentFeedbackLoopMetrics['feedbackResponsiveness'], string> = {
  high: 'bg-green-900/50 text-green-300 border border-green-700/50',
  medium: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  low: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  none: 'bg-gray-800/50 text-gray-400 border border-gray-700/50',
};

const TREND_CONFIG: Record<AgentFeedbackLoopMetrics['recentTrend'], { style: string; icon: React.ReactNode }> = {
  improving: {
    style: 'text-green-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
  },
  stable: {
    style: 'text-gray-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
  },
  degrading: {
    style: 'text-red-400',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
  },
};

export default function AgentFeedbackLoopModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  const sorted = result ? [...result].sort((a, b) => b.improvementRate - a.improvementRate) : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Feedback Loop Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.length} agent{result.length !== 1 ? 's' : ''} analyzed
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing agent feedback loops...</span>
            </div>
          )}

          {!loading && result && result.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent session data available for this project
            </div>
          )}

          {!loading && sorted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3 pr-4 font-medium">Persona</th>
                    <th className="pb-3 pr-4 font-medium text-right">Feedback Events</th>
                    <th className="pb-3 pr-4 font-medium text-right">Improvement Rate</th>
                    <th className="pb-3 pr-4 font-medium text-right">Avg Recovery</th>
                    <th className="pb-3 pr-4 font-medium">Responsiveness</th>
                    <th className="pb-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sorted.map((agent) => {
                    const trend = TREND_CONFIG[agent.recentTrend];
                    return (
                      <tr key={agent.personaId} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="font-medium text-white">{agent.personaId}</span>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-300">{agent.totalFeedbackEvents}</td>
                        <td className="py-3 pr-4 text-right">
                          <span className={agent.improvementRate >= 70 ? 'text-green-400' : agent.improvementRate >= 40 ? 'text-blue-400' : agent.improvementRate > 0 ? 'text-yellow-400' : 'text-gray-500'}>
                            {agent.improvementRate}%
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-300">
                          {agent.averageRecoveryTime > 0 ? `${agent.averageRecoveryTime} sess` : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RESPONSIVENESS_STYLES[agent.feedbackResponsiveness]}`}>
                            {agent.feedbackResponsiveness}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 ${trend.style}`}>
                            {trend.icon}
                            <span className="text-xs capitalize">{agent.recentTrend}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
