import { useState } from 'react';
import type { StallDetectionReport, AgentStallSummary, StalledTicket } from '../../api/mutations.js';

interface AgentStallDetectorModalProps {
  result: StallDetectionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function severityBadgeClass(severity: StalledTicket['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function AgentStallCard({ summary }: { summary: AgentStallSummary }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? summary.stalledTickets : summary.stalledTickets.slice(0, 3);
  const hasMore = summary.stalledTickets.length > 3;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-white">{summary.agentPersona}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
            {summary.stalledCount} stalled
          </span>
          <span className="text-xs text-gray-400">avg {summary.avgStalledHours}h</span>
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((t) => (
          <div key={t.ticketId} className="flex items-center gap-2 text-xs">
            <span className="text-gray-300 flex-1 truncate">{t.title}</span>
            <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 shrink-0">{t.status}</span>
            <span className={`px-1.5 py-0.5 rounded-full border capitalize shrink-0 ${severityBadgeClass(t.severity)}`}>
              {t.severity}
            </span>
            <span className="text-gray-500 shrink-0">{t.stalledForHours}h</span>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? 'Show less' : `+${summary.stalledTickets.length - 3} more`}
        </button>
      )}
    </div>
  );
}

export default function AgentStallDetectorModal({ result, isOpen, loading, onClose }: AgentStallDetectorModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Agent Stall Detector
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {result.totalStalledTickets} stalled
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Detecting stalled tickets...</span>
              </div>
            </div>
          ) : !result || result.totalStalledTickets === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No stalled tickets detected — all agents are making progress.</p>
            </div>
          ) : (
            <>
              {/* Critical stalls warning */}
              {result.criticalStalls > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-red-300 font-medium">
                    {result.criticalStalls} critical stall{result.criticalStalls !== 1 ? 's' : ''} — tickets stuck &gt;72h
                  </span>
                </div>
              )}

              {/* Most stalled agent banner */}
              {result.mostStalledAgent && (
                <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3">
                  <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-orange-300">
                    Most stalled: <span className="font-semibold">{result.mostStalledAgent}</span>
                  </span>
                </div>
              )}

              {/* Agent stall cards */}
              <div className="space-y-3">
                {result.agentSummaries.map((summary) => (
                  <AgentStallCard key={summary.agentPersona} summary={summary} />
                ))}
              </div>

              {/* AI Recommendation */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-amber-300 uppercase tracking-wider">AI Recommendation</span>
                </div>
                <p className="text-sm text-amber-100 leading-relaxed">{result.aiRecommendation}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
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
