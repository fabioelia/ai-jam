import React from 'react';
import { AgentCommunicationProfile, CommunicationPattern, CommunicationQualityReport } from '../../api/mutations.js';

interface Props {
  result: CommunicationQualityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentCommunicationProfile['tier'], string> = {
  excellent: 'bg-green-900/50 text-green-300 border border-green-700/50',
  good: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  fair: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  poor: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-blue-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-gray-300 w-8 text-right">{value}%</span>
    </div>
  );
}

function PatternItem({ pattern }: { pattern: CommunicationPattern }) {
  const isPositive = pattern.impact === 'positive';
  return (
    <div className={`flex items-start gap-2 rounded-lg p-2.5 ${isPositive ? 'bg-green-900/20 border border-green-700/30' : 'bg-red-900/20 border border-red-700/30'}`}>
      {isPositive ? (
        <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium ${isPositive ? 'text-green-300' : 'text-red-300'}`}>{pattern.pattern}</span>
        <span className="text-xs text-gray-500 ml-1">({pattern.frequency} agents)</span>
      </div>
    </div>
  );
}

export default function AgentCommunicationQualityModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Agent Communication Quality</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.summary.totalAgents} agents · avg score{' '}
                <span className={scoreColor(result.summary.avgQualityScore)}>{result.summary.avgQualityScore}</span>
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
              <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing communication quality…</span>
            </div>
          )}

          {!loading && !result && (
            <div className="text-center py-12 text-gray-500 text-sm">No data yet. Run the analysis to see results.</div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">No handoff notes found for this project. Agents need to send handoffs to generate communication data.</div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-white">{result.summary.totalAgents}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Agents</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${scoreColor(result.summary.avgQualityScore)}`}>{result.summary.avgQualityScore}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Avg Score</div>
                </div>
                {result.summary.bestCommunicator && (
                  <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 col-span-2 sm:col-span-1">
                    <div className="text-xs text-gray-400">Best</div>
                    <div className="text-sm font-medium text-green-300 truncate">{result.summary.bestCommunicator}</div>
                  </div>
                )}
                {result.summary.worstCommunicator && result.summary.worstCommunicator !== result.summary.bestCommunicator && (
                  <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 col-span-2 sm:col-span-1">
                    <div className="text-xs text-gray-400">Needs Work</div>
                    <div className="text-sm font-medium text-red-300 truncate">{result.summary.worstCommunicator}</div>
                  </div>
                )}
              </div>

              {/* Agent list */}
              <div className="space-y-2">
                {result.agents.map((agent) => (
                  <div key={agent.agentPersona} className="bg-gray-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm flex-1 truncate">{agent.agentPersona}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_STYLES[agent.tier]}`}>
                        {agent.tier}
                      </span>
                      <span className={`text-sm font-bold ${scoreColor(agent.qualityScore)}`}>{agent.qualityScore}</span>
                    </div>
                    <div className="space-y-1.5">
                      <ScoreBar value={agent.contextRichness} label="Context richness" />
                      <ScoreBar value={Math.max(0, 100 - agent.clarificationRate)} label="Clarity (inv. clarif.)" />
                      <ScoreBar value={agent.downstreamSuccessRate} label="Downstream success" />
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>{agent.handoffsSent} sent</span>
                      <span>avg {agent.avgMessageLength} chars</span>
                      <span>clarif. rate {agent.clarificationRate}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Patterns */}
              {result.patterns.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Detected Patterns</h3>
                  <div className="space-y-2">
                    {result.patterns.map((p) => (
                      <PatternItem key={p.pattern} pattern={p} />
                    ))}
                  </div>
                </div>
              )}

              {/* AI summary */}
              {result.aiSummary && (
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Analysis</h3>
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>
                </div>
              )}

              {/* Recommendations */}
              {result.aiRecommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Recommendations</h3>
                  <ul className="space-y-1.5">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <svg className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
