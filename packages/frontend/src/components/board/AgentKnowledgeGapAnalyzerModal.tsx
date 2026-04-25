import { useState } from 'react';
import type { KnowledgeGapReport } from '../../api/mutations.js';

interface AgentKnowledgeGapAnalyzerModalProps {
  result: KnowledgeGapReport | null;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'proficient': return 'bg-green-900/30 text-green-400 border-green-700/30';
    case 'minor_gaps': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/30';
    case 'critical_gaps': return 'bg-red-900/30 text-red-400 border-red-700/30';
    default: return 'bg-gray-900/30 text-gray-400 border-gray-700/30';
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'proficient': return 'Proficient';
    case 'minor_gaps': return 'Minor Gaps';
    case 'critical_gaps': return 'Critical Gaps';
    default: return 'Insufficient Data';
  }
}

export default function AgentKnowledgeGapAnalyzerModal({ result, loading, onClose }: AgentKnowledgeGapAnalyzerModalProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  function toggleAgent(agentId: string) {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Agent Knowledge Gap Analyzer
            {result && (
              <span className="text-sm font-normal text-red-400/80 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                {result.summary.totalAgents} agents
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing knowledge gaps...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-gray-400 text-sm">No knowledge gap data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-red-200 text-xl font-bold">{result.summary.totalAgents}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Proficient</p>
                  <p className="text-green-200 text-xl font-bold">{result.summary.proficientCount}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Critical Gaps</p>
                  <p className="text-red-200 text-xl font-bold">{result.summary.criticalGapsCount}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Total Gaps Detected</p>
                  <p className="text-red-200 text-xl font-bold">{result.summary.totalGapsDetected}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left w-6"></th>
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-center">Total Tickets</th>
                      <th className="px-4 py-3 text-center">Categories</th>
                      <th className="px-4 py-3 text-center">Gaps Found</th>
                      <th className="px-4 py-3 text-center">Gap Score</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((metric, i) => (
                      <>
                        <tr
                          key={`row-${i}`}
                          className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                          onClick={() => toggleAgent(metric.agentId)}
                        >
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {expandedAgents.has(metric.agentId) ? '▼' : '▶'}
                          </td>
                          <td className="px-4 py-3 text-white font-medium">{metric.agentName}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{metric.agentRole}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{metric.totalTickets}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{metric.categoryBreakdown.length}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{metric.gapCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-red-500"
                                  style={{ width: `${metric.overallGapScore}%` }}
                                />
                              </div>
                              <span className="text-gray-200 font-mono text-xs">{metric.overallGapScore.toFixed(1)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${tierBadgeClass(metric.gapTier)}`}>
                              {tierLabel(metric.gapTier)}
                            </span>
                          </td>
                        </tr>
                        {expandedAgents.has(metric.agentId) && metric.categoryBreakdown.length > 0 && (
                          <tr key={`expanded-${i}`}>
                            <td colSpan={8} className="px-6 py-3 bg-gray-800/20">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 uppercase tracking-wide">
                                    <th className="px-3 py-2 text-left">Category</th>
                                    <th className="px-3 py-2 text-center">Tickets</th>
                                    <th className="px-3 py-2 text-center">Completed</th>
                                    <th className="px-3 py-2 text-center">Completion Rate</th>
                                    <th className="px-3 py-2 text-center">vs Avg</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                  {metric.categoryBreakdown.map((cat, j) => (
                                    <tr
                                      key={j}
                                      className={cat.performanceVsAvg < -0.2 ? 'bg-red-900/30' : ''}
                                    >
                                      <td className="px-3 py-2 text-gray-300 capitalize">{cat.category}</td>
                                      <td className="px-3 py-2 text-center text-gray-400">{cat.ticketCount}</td>
                                      <td className="px-3 py-2 text-center text-gray-400">{cat.completedCount}</td>
                                      <td className="px-3 py-2 text-center text-gray-300">{(cat.completionRate * 100).toFixed(1)}%</td>
                                      <td className={`px-3 py-2 text-center font-medium ${cat.performanceVsAvg < -0.2 ? 'text-red-400' : cat.performanceVsAvg >= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {cat.performanceVsAvg >= 0 ? '+' : ''}{(cat.performanceVsAvg * 100).toFixed(1)}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gradient-to-r from-red-900/20 to-red-800/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-red-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-red-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                {result.aiRecommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-red-100/70 text-sm flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
