import type { AgentContextProfile, ContextUtilizationReport } from '../../api/mutations.js';

interface AgentContextUtilizationModalProps {
  result: ContextUtilizationReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

type ContextRating = AgentContextProfile['contextRating'];

function ratingBadgeClass(r: ContextRating): string {
  switch (r) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'poor': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'good': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'excellent': return 'bg-green-500/20 text-green-300 border-green-500/40';
  }
}

function ratingLabel(r: ContextRating): string {
  switch (r) {
    case 'critical': return 'Critical';
    case 'poor': return 'Poor';
    case 'good': return 'Good';
    case 'excellent': return 'Excellent';
  }
}

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-blue-500' : score >= 25 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-8 text-right">{score}</span>
    </div>
  );
}

function ProfileRow({ profile }: { profile: AgentContextProfile }) {
  return (
    <div className={`border rounded-lg p-3 space-y-2 ${profile.contextRating === 'critical' ? 'bg-red-900/10 border-red-800/40' : 'bg-gray-800/50 border-gray-700'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-white">{profile.agentPersona}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ratingBadgeClass(profile.contextRating)}`}>
          {ratingLabel(profile.contextRating)}
        </span>
      </div>
      <ScoreGauge score={profile.contextScore} />
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <div className="text-gray-200 font-semibold">{profile.totalTickets}</div>
          <div className="text-gray-500">Tickets</div>
        </div>
        <div className="text-center">
          <div className="text-gray-200 font-semibold">{profile.ticketsWithDescription}</div>
          <div className="text-gray-500">With Desc</div>
        </div>
        <div className="text-center">
          <div className="text-gray-200 font-semibold">{profile.ticketsWithLinkedHandoffs}</div>
          <div className="text-gray-500">Linked</div>
        </div>
        <div className="text-center">
          <div className="text-gray-200 font-semibold">{profile.avgDescriptionLength}</div>
          <div className="text-gray-500">Avg Chars</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 italic leading-relaxed">{profile.recommendation}</p>
    </div>
  );
}

export default function AgentContextUtilizationModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentContextUtilizationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-white">AI Agent Context Utilization Analyzer</h2>
              <p className="text-xs text-gray-400">Analyze how effectively agents utilize context from tickets and handoffs</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!loading && !result && (
            <p className="text-sm text-gray-400 text-center py-8">No analysis available.</p>
          )}

          {!loading && result && (
            <>
              {/* AI Summary */}
              <div className="bg-teal-900/20 border border-teal-700/40 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">AI Summary</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{result.summary}</p>
              </div>

              {/* Critical warning bar */}
              {result.criticalAgents.length > 0 && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-2.5">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-red-300 font-medium">
                    {result.criticalAgents.length} agent{result.criticalAgents.length === 1 ? '' : 's'} have critical context gaps
                  </span>
                </div>
              )}

              {/* Profiles */}
              {result.profiles.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <svg className="w-10 h-10 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-300 font-medium">All agents maintain good context utilization</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Agent Profiles</h4>
                  {result.profiles.map(profile => (
                    <ProfileRow key={profile.agentPersona} profile={profile} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
