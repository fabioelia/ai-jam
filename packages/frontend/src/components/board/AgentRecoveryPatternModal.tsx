import React from 'react';
import { RecoveryPatternReport, AgentRecoveryProfile, RecoveryEvent } from '../../api/mutations.js';

interface Props {
  result: RecoveryPatternReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const METHOD_STYLES: Record<RecoveryEvent['recoveryMethod'], string> = {
  self: 'bg-green-900/50 text-green-300 border border-green-700/50',
  handoff: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  escalation: 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  unresolved: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default function AgentRecoveryPatternModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Recovery Pattern Analyzer</h2>
            {result && <p className="text-sm text-gray-400 mt-0.5">{result.totalFailureEvents} failure events · {result.agentProfiles.length} agents</p>}
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
              <svg className="w-8 h-8 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing recovery patterns...</span>
            </div>
          )}

          {!loading && result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Failure Events" value={String(result.totalFailureEvents)} />
                <StatCard label="Recovery Rate" value={`${(result.overallRecoveryRate * 100).toFixed(1)}%`} />
                <StatCard label="Avg Recovery" value={`${result.avgRecoveryTimeHours.toFixed(1)}h`} />
              </div>

              <p className="text-sm text-gray-300 italic">{result.aiInsights}</p>

              {result.agentProfiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No failure events detected.</div>
              ) : (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Agent Profiles</div>
                  <div className="space-y-2">
                    {result.agentProfiles.map(profile => (
                      <div key={profile.agentPersona} className="rounded-lg bg-gray-800 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-white text-sm">{profile.agentPersona}</span>
                          <span className="text-xs text-gray-400">{(profile.recoveryRate * 100).toFixed(0)}% recovery rate</span>
                        </div>
                        <div className="text-xs text-gray-400 flex gap-3 flex-wrap">
                          <span>Failures: <span className="text-gray-200">{profile.totalFailureEvents}</span></span>
                          <span>Recovered: <span className="text-green-300">{profile.recoveredCount}</span></span>
                          <span>Unresolved: <span className="text-red-300">{profile.failedToRecover}</span></span>
                          <span>Self-recovery: <span className="text-gray-200">{(profile.selfRecoveryRate * 100).toFixed(0)}%</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.recentEvents.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recent Events</div>
                  <div className="space-y-1">
                    {result.recentEvents.map(event => (
                      <div key={event.ticketId} className="rounded bg-gray-800/60 px-3 py-2 flex items-center gap-2 text-xs">
                        <span className="text-gray-300 flex-1 truncate">{event.agentPersona}</span>
                        <span className="text-gray-500">{event.cycleTimeHours.toFixed(1)}h</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${METHOD_STYLES[event.recoveryMethod]}`}>{event.recoveryMethod}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.recommendations.length > 0 && (
                <div className="rounded-lg bg-gray-800/50 p-3">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Recommendations</div>
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-2 text-sm text-gray-300 mb-1">
                      <span className="text-teal-400 shrink-0">•</span>
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
