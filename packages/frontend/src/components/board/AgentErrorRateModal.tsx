import React from 'react';
import { AgentErrorRateReport, AgentErrorMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentErrorRateReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : score >= 25 ? '#f97316' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{score}</text>
      </svg>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

const CLASSIFICATION_STYLES: Record<AgentErrorMetrics['classification'], string> = {
  critical: 'bg-red-900/50 text-red-300 border border-red-700/50',
  high: 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  moderate: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  low: 'bg-green-900/50 text-green-300 border border-green-700/50',
};

function AgentRow({ agent }: { agent: AgentErrorMetrics }) {
  return (
    <div className="rounded-lg p-3 bg-gray-800 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-white text-sm block truncate">{agent.agentPersona}</span>
        <div className="text-xs text-gray-400 flex gap-3 mt-0.5 flex-wrap">
          <span>Tasks: <span className="text-gray-200">{agent.totalTasks}</span></span>
          <span>Failed: <span className="text-gray-200">{agent.failedTasks}</span></span>
          <span>Error Rate: <span className="text-gray-200">{(agent.errorRate * 100).toFixed(1)}%</span></span>
          <span>Reliability: <span className="text-gray-200">{agent.reliabilityScore.toFixed(1)}</span></span>
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CLASSIFICATION_STYLES[agent.classification]}`}>
        {agent.classification}
      </span>
    </div>
  );
}

export default function AgentErrorRateModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Error Rate Tracker</h2>
            {result && <p className="text-sm text-gray-400 mt-0.5">{result.agents.length} agents · {result.criticalCount} critical</p>}
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
              <svg className="w-8 h-8 animate-spin text-rose-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing error rates...</span>
            </div>
          )}

          {!loading && result && (
            <>
              <div className="flex items-start gap-6">
                <ScoreRing score={Math.round(result.avgReliabilityScore)} label="Avg Reliability" />
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {result.criticalCount > 0 && <div className="bg-red-900/20 rounded p-2 border border-red-700/30">
                      <div className="text-red-300 font-medium">{result.criticalCount} Critical</div>
                      <div className="text-gray-400">agents need attention</div>
                    </div>}
                    {result.mostReliableAgent && <div className="bg-green-900/20 rounded p-2 border border-green-700/30">
                      <div className="text-green-300 font-medium truncate">{result.mostReliableAgent}</div>
                      <div className="text-gray-400">most reliable</div>
                    </div>}
                    {result.leastReliableAgent && result.leastReliableAgent !== result.mostReliableAgent && (
                      <div className="bg-red-900/20 rounded p-2 border border-red-700/30">
                        <div className="text-red-300 font-medium truncate">{result.leastReliableAgent}</div>
                        <div className="text-gray-400">least reliable</div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>
                </div>
              </div>

              {result.agents.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">No agent data — assign tickets to track error rates.</div>
              ) : (
                <div className="space-y-2">
                  {result.agents.map(agent => <AgentRow key={agent.agentPersona} agent={agent} />)}
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="rounded-lg bg-gray-800/50 p-3 space-y-1">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recommendations</div>
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-rose-400 shrink-0">•</span>
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
