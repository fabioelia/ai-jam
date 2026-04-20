import React from 'react';
import { AgentEscalationPatternReport, EscalationChain, EscalationHotspot } from '../../api/mutations.js';

interface Props {
  result: AgentEscalationPatternReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const SEVERITY_STYLES: Record<EscalationHotspot['severity'], string> = {
  critical: 'bg-red-900/50 text-red-300 border border-red-700/50',
  high: 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  moderate: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  low: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
};

export default function AgentEscalationPatternModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Escalation Pattern Analyzer</h2>
            {result && <p className="text-sm text-gray-400 mt-0.5">{result.totalEscalations} escalations · {result.chains.length} chains</p>}
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
              <span className="text-gray-400 text-sm">Analyzing escalation patterns...</span>
            </div>
          )}

          {!loading && result && (
            <>
              {result.totalEscalations === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">No escalation data found. Good sign!</div>
              ) : (
                <>
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>

                  {result.chains.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Escalation Chains</div>
                      <div className="space-y-2">
                        {result.chains.map((chain, i) => (
                          <div key={i} className="rounded-lg bg-gray-800 p-3 flex items-center gap-3">
                            <div className="flex-1 text-sm text-gray-200">
                              <span className="text-orange-300 font-medium">{chain.fromAgent}</span>
                              <span className="text-gray-500 mx-2">→</span>
                              <span className="text-blue-300 font-medium">{chain.toAgent}</span>
                            </div>
                            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{chain.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.hotspots.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Hotspots</div>
                      <div className="space-y-2">
                        {result.hotspots.map(h => (
                          <div key={h.agentPersona} className="rounded-lg bg-gray-800 p-3 flex items-center gap-3">
                            <span className="flex-1 text-sm text-white font-medium">{h.agentPersona}</span>
                            <span className="text-xs text-gray-400">{h.escalationCount} escalations</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[h.severity]}`}>{h.severity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.circularPatterns.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-red-400 uppercase tracking-wide mb-2">Circular Patterns ({result.circularPatterns.length})</div>
                      <div className="space-y-1">
                        {result.circularPatterns.map((cycle, i) => (
                          <div key={i} className="text-sm text-red-300 bg-red-900/10 rounded px-3 py-1.5 border border-red-700/20">
                            {cycle.join(' → ')} → {cycle[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.aiRecommendations.length > 0 && (
                    <div className="rounded-lg bg-gray-800/50 p-3 space-y-1">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recommendations</div>
                      {result.aiRecommendations.map((rec, i) => (
                        <div key={i} className="flex gap-2 text-sm text-gray-300">
                          <span className="text-orange-400 shrink-0">•</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {!loading && !result && <div className="text-center py-12 text-gray-500 text-sm">No data available.</div>}
        </div>
      </div>
    </div>
  );
}
