import type { CollaborationNetworkReport, CollaborationLink } from '../../api/mutations.js';

interface AgentCollaborationNetworkModalProps {
  result: CollaborationNetworkReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function strengthBadgeClass(strength: CollaborationLink['collaborationStrength']): string {
  switch (strength) {
    case 'strong': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function strengthLabel(strength: CollaborationLink['collaborationStrength']): string {
  switch (strength) {
    case 'strong': return 'Strong';
    case 'moderate': return 'Moderate';
    default: return 'Weak';
  }
}

export default function AgentCollaborationNetworkModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentCollaborationNetworkModalProps) {
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
            <svg className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Agent Collaboration Network
            {result && (
              <span className="text-sm font-normal text-pink-400/80 border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 rounded-full">
                {result.totalHandoffsAnalyzed} handoffs
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Mapping collaboration network...</span>
              </div>
            </div>
          ) : !result || result.allLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No handoff data found for collaboration analysis.</p>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-full bg-gray-700/60 border border-gray-600/40 text-gray-300">
                  {result.totalAgentsInNetwork} agent{result.totalAgentsInNetwork !== 1 ? 's' : ''} in network
                </span>
                {result.mostCollaborativeAgent && (
                  <span className="text-xs px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                    Most collaborative: {result.mostCollaborativeAgent}
                  </span>
                )}
                <span className="text-xs px-3 py-1 rounded-full bg-gray-700/60 border border-gray-600/40 text-gray-300">
                  {result.isolatedAgents.length} isolated agent{result.isolatedAgents.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Isolated agents warning */}
              {result.isolatedAgents.length > 0 && (
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                  <p className="text-orange-300 text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Isolated: {result.isolatedAgents.join(', ')}
                  </p>
                </div>
              )}

              {/* Collaboration links */}
              <div className="space-y-2">
                <h3 className="text-gray-300 font-medium text-sm">Collaboration Links</h3>
                {result.allLinks.map((link, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 text-sm text-white min-w-0">
                      <span className="font-medium truncate">{link.fromAgent}</span>
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="font-medium truncate">{link.toAgent}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-700/60 border-gray-600/40 text-gray-300 font-mono">
                        {link.handoffCount}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${strengthBadgeClass(link.collaborationStrength)}`}>
                        {strengthLabel(link.collaborationStrength)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI insight */}
              <div className="bg-gradient-to-br from-pink-900/20 to-rose-900/20 border border-pink-500/30 rounded-lg p-4 space-y-2">
                <h3 className="text-pink-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Insight
                </h3>
                <p className="text-pink-100/80 text-sm leading-relaxed">{result.networkInsight}</p>
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
