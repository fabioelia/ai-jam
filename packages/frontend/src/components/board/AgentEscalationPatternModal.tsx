import React from 'react';
import { EscalationAnalysis, EscalationChain, EscalationHotspot } from '../../api/mutations.js';

interface Props {
  result: EscalationAnalysis | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const SEVERITY_STYLES = {
  critical: 'bg-red-900/50 text-red-300 border border-red-700/50',
  high: 'bg-rose-900/50 text-rose-300 border border-rose-700/50',
  moderate: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  low: 'bg-green-900/50 text-green-300 border border-green-700/50',
};

function StatsBar({ result }: { result: EscalationAnalysis }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Escalations', value: result.totalEscalations, color: 'text-orange-400' },
        { label: 'Circular Patterns', value: result.circularPatterns.length, color: result.circularPatterns.length > 0 ? 'text-red-400' : 'text-white' },
        { label: 'Avg Chain Length', value: result.avgChainLength.toFixed(1), color: 'text-white' },
        { label: 'Hotspot Agents', value: result.hotspots.length, color: 'text-white' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-xl font-bold ${color}`}>{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function CircularAlert({ patterns }: { patterns: string[][] }) {
  const [expanded, setExpanded] = React.useState(false);
  if (patterns.length === 0) return null;
  return (
    <div className="bg-red-950/50 border border-red-700/50 rounded-lg p-3">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-red-400 font-medium text-sm">
          ⚠ {patterns.length} circular escalation loop{patterns.length > 1 ? 's' : ''} detected
        </span>
        <svg
          className={`w-4 h-4 text-red-400 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {patterns.map((cycle, i) => (
            <div key={i} className="text-xs text-red-300 font-mono bg-red-900/30 rounded px-2 py-1">
              {cycle.join(' → ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HotspotRow({ h }: { h: EscalationHotspot }) {
  return (
    <tr className="border-t border-gray-700/50 hover:bg-gray-800/50">
      <td className="py-2 px-3 text-sm text-white">{h.agentId}</td>
      <td className="py-2 px-3 text-sm text-center text-gray-300">{h.escalationsReceived}</td>
      <td className="py-2 px-3 text-sm text-center text-gray-300">{h.escalationsSent}</td>
      <td className="py-2 px-3 text-sm text-center text-gray-300">{h.escalationRate.toFixed(1)}%</td>
      <td className="py-2 px-3 text-center">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[h.severity]}`}>
          {h.severity}
        </span>
      </td>
    </tr>
  );
}

function ChainRow({ c }: { c: EscalationChain }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">
          {c.fromAgent} <span className="text-orange-400">→</span> {c.toAgent}
        </div>
        {c.topTriggers.length > 0 && (
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {c.topTriggers.join(', ')}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-orange-400">{c.count}x</div>
        <div className="text-xs text-gray-400">
          {c.avgResolutionTime !== null ? `${c.avgResolutionTime}h avg` : 'unresolved'}
        </div>
      </div>
    </div>
  );
}

export default function AgentEscalationPatternModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Escalation Pattern Analyzer</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.totalEscalations} escalation{result.totalEscalations !== 1 ? 's' : ''} analyzed
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
              <svg className="w-8 h-8 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing escalation patterns...</span>
            </div>
          )}

          {!loading && result && result.totalEscalations === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No escalation patterns detected
            </div>
          )}

          {!loading && result && result.totalEscalations > 0 && (
            <>
              <StatsBar result={result} />

              <CircularAlert patterns={result.circularPatterns} />

              {result.hotspots.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Escalation Hotspots</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-left">
                      <thead className="bg-gray-800">
                        <tr>
                          {['Agent', 'Received', 'Sent', 'Rate', 'Severity'].map((h) => (
                            <th key={h} className="py-2 px-3 text-xs font-medium text-gray-400 text-center first:text-left">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.hotspots.map((h) => (
                          <HotspotRow key={h.agentId} h={h} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.chains.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Top Escalation Chains</h3>
                  <div className="space-y-2">
                    {result.chains.slice(0, 5).map((c, i) => (
                      <ChainRow key={i} c={c} />
                    ))}
                  </div>
                </div>
              )}

              {result.aiSummary && result.aiSummary !== 'Analysis unavailable' && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">AI Analysis</h3>
                  <p className="text-sm text-gray-300">{result.aiSummary}</p>
                </div>
              )}

              {result.aiRecommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Recommendations</h3>
                  <ol className="space-y-1 list-decimal list-inside">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300">{rec}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
