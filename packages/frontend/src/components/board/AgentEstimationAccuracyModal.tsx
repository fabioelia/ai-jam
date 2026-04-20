import React from 'react';
import { AgentEstimationData, AgentEstimationAccuracyReport } from '../../api/mutations.js';

interface Props {
  result: AgentEstimationAccuracyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentEstimationData['estimationTier'], string> = {
  precise: 'bg-green-500/20 text-green-400',
  reasonable: 'bg-blue-500/20 text-blue-400',
  unreliable: 'bg-yellow-500/20 text-yellow-400',
  erratic: 'bg-red-500/20 text-red-400',
};

const BIAS_STYLES: Record<AgentEstimationData['estimationBias'], string> = {
  accurate: 'bg-green-500/20 text-green-400',
  pessimistic: 'bg-orange-500/20 text-orange-400',
  optimistic: 'bg-cyan-500/20 text-cyan-400',
  none: 'bg-gray-500/20 text-gray-400',
};

export default function AgentEstimationAccuracyModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Estimation Accuracy Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.summary.totalAgents} agents · {result.agents.length} analyzed
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-lime-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing estimation accuracy...</span>
            </div>
          )}

          {!loading && result && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Total Agents</div>
                  <div className="text-xl font-bold text-white">{result.summary.totalAgents}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Avg Estimation Score</div>
                  <div className="text-xl font-bold text-lime-400">{result.summary.avgEstimationScore}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Most Precise Agent</div>
                  <div className="text-sm font-semibold text-green-400 truncate">{result.summary.mostPreciseAgent || '—'}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">Accurate Count</div>
                  <div className="text-xl font-bold text-white">{result.summary.accurateEstimationCount}</div>
                </div>
              </div>

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No agent sessions found. Run some agent sessions to enable estimation accuracy tracking.
                </div>
              ) : (
                <>
                  {/* Agent table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                          <th className="pb-2 pr-3 font-medium">Agent</th>
                          <th className="pb-2 pr-3 font-medium">Tier</th>
                          <th className="pb-2 pr-3 font-medium w-32">Score</th>
                          <th className="pb-2 pr-3 font-medium">Bias</th>
                          <th className="pb-2 pr-3 font-medium text-right">Within Range</th>
                          <th className="pb-2 font-medium text-right">Avg Error %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {result.agents.map(agent => (
                          <tr key={agent.agentId} className="text-gray-200">
                            <td className="py-2.5 pr-3">
                              <span className="font-medium text-white">{agent.agentName}</span>
                            </td>
                            <td className="py-2.5 pr-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_STYLES[agent.estimationTier]}`}>
                                {agent.estimationTier}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className="bg-lime-500 h-1.5 rounded-full"
                                    style={{ width: `${(agent.estimationScore / 100) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-300 w-6 text-right">{agent.estimationScore}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BIAS_STYLES[agent.estimationBias]}`}>
                                {agent.estimationBias}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 text-right text-gray-300">
                              {agent.estimationsWithinRange}/{agent.estimationsProvided}
                            </td>
                            <td className="py-2.5 text-right text-gray-300">
                              {agent.avgEstimationError.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* AI Analysis section */}
                  {(result.insights.length > 0 || result.recommendations.length > 0) && (
                    <div className="rounded-lg bg-gradient-to-br from-lime-900/20 to-green-900/20 border border-lime-700/30 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-lime-400">AI Analysis</h3>
                      {result.insights.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Insights</div>
                          <ul className="space-y-1">
                            {result.insights.map((insight, i) => (
                              <li key={i} className="text-sm text-gray-300 flex gap-2">
                                <span className="text-lime-500 mt-0.5 shrink-0">•</span>
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.recommendations.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Recommendations</div>
                          <ul className="space-y-1">
                            {result.recommendations.map((rec, i) => (
                              <li key={i} className="text-sm text-gray-300 flex gap-2">
                                <span className="text-green-500 mt-0.5 shrink-0">→</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!loading && !result && (
            <div className="text-center py-12 text-gray-500 text-sm">No data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
