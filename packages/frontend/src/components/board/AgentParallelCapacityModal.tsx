import React from 'react';
import { AgentParallelCapacityReport, AgentParallelMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentParallelCapacityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const RATING_STYLES: Record<AgentParallelMetrics['rating'], string> = {
  optimal: 'bg-green-900/50 text-green-300 border border-green-700/50',
  loaded: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  overloaded: 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  saturated: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

export default function AgentParallelCapacityModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Parallel Task Capacity Analyzer</h2>
            {result && <p className="text-sm text-gray-400 mt-0.5">{result.agents.length} agents · max load: {result.maxParallelLoad}</p>}
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
              <span className="text-gray-400 text-sm">Analyzing parallel capacity...</span>
            </div>
          )}

          {!loading && result && (
            <>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{result.maxParallelLoad}</div>
                  <div className="text-gray-400">Max Load</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{result.avgParallelLoad.toFixed(1)}</div>
                  <div className="text-gray-400">Avg Load</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{result.overloadedAgentCount}</div>
                  <div className="text-gray-400">Overloaded</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{result.optimalConcurrency}</div>
                  <div className="text-gray-400">Optimal Conc.</div>
                </div>
              </div>

              {result.overloadedAgentCount > 0 && (
                <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-sm text-amber-300">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {result.overloadedAgentCount} agent{result.overloadedAgentCount > 1 ? 's' : ''} overloaded — consider reassigning tasks.
                </div>
              )}

              <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">No agent data available.</div>
              ) : (
                <div className="space-y-2">
                  {result.agents.map(agent => (
                    <div key={agent.agentPersona} className="rounded-lg bg-gray-800 p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-white text-sm block truncate">{agent.agentPersona}</span>
                        <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                          <span>In-progress: <span className="text-gray-200">{agent.currentParallelCount}</span></span>
                          <span>Efficiency: <span className="text-gray-200">{agent.efficiencyScore.toFixed(2)}</span></span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${RATING_STYLES[agent.rating]}`}>{agent.rating}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="rounded-lg bg-gray-800/50 p-3">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recommendations</div>
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-2 text-sm text-gray-300 mb-1">
                      <span className="text-cyan-400 shrink-0">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !result && <div className="text-center py-12 text-gray-500 text-sm">No data available.</div>}
        </div>
      </div>
    </div>
  );
}
