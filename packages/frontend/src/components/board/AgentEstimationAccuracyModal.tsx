import React from 'react';
import { AgentEstimationData, AgentEstimationAccuracyReport } from '../../api/mutations.js';

interface Props {
  result: AgentEstimationAccuracyReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentEstimationData['estimationTier'], string> = {
  precise: 'bg-green-900/50 text-green-300',
  reasonable: 'bg-blue-900/50 text-blue-300',
  unreliable: 'bg-yellow-900/50 text-yellow-300',
  erratic: 'bg-red-900/50 text-red-300',
};

const BIAS_STYLES: Record<AgentEstimationData['estimationBias'], string> = {
  accurate: 'bg-green-900/50 text-green-300',
  pessimistic: 'bg-orange-900/50 text-orange-300',
  optimistic: 'bg-cyan-900/50 text-cyan-300',
  none: 'bg-gray-700 text-gray-300',
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
              <svg className="w-8 h-8 animate-spin text-lime-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing estimation accuracy...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              No done tickets with story points found. Assign story points to completed tickets to enable accuracy tracking.
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Agents', value: result.summary.totalAgents },
                  { label: 'Avg Estimation Score', value: result.summary.avgEstimationScore.toFixed(1) },
                  { label: 'Most Precise Agent', value: result.summary.mostPreciseAgent || '\u2014' },
                  { label: 'Accurate Count', value: result.summary.accurateEstimationCount },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-base font-bold text-white truncate">{value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Bias</th>
                      <th className="px-4 py-3 text-center">Within Range</th>
                      <th className="px-4 py-3 text-center">Avg Error %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TIER_STYLES[agent.estimationTier]}`}>
                            {agent.estimationTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-lime-500"
                                style={{ width: `${Math.min(100, agent.estimationScore)}%` }}
                              />
                            </div>
                            <span className="text-gray-300 font-mono text-xs">{agent.estimationScore.toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${BIAS_STYLES[agent.estimationBias]}`}>
                            {agent.estimationBias}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">
                          {agent.estimationsWithinRange}/{agent.estimationsProvided}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.avgEstimationError.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI insights section */}
              {(result.insights.length > 0 || result.recommendations.length > 0) && (
                <div className="bg-gradient-to-r from-lime-900/20 to-green-900/20 border border-lime-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-lime-300 mb-2">Insights</h3>
                  {result.insights.map((insight, i) => (
                    <p key={i} className="text-sm text-gray-300 mb-1 flex items-start gap-2">
                      <span className="text-lime-400 mt-0.5">&bull;</span>{insight}
                    </p>
                  ))}
                  {result.recommendations.length > 0 && (
                    <>
                      <h3 className="text-sm font-medium text-lime-300 mt-3 mb-2">Recommendations</h3>
                      {result.recommendations.map((rec, i) => (
                        <p key={i} className="text-sm text-gray-400 mb-1 flex items-start gap-2">
                          <span className="text-lime-400 mt-0.5">&rarr;</span>{rec}
                        </p>
                      ))}
                    </>
                  )}
                </div>
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
