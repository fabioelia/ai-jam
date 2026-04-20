import type { AgentQueueProfile, QueueDepthReport } from '../../api/mutations.js';

interface AgentQueueDepthModalProps {
  result: QueueDepthReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function riskBadgeClass(risk: 'low' | 'medium' | 'high'): string {
  switch (risk) {
    case 'high': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-green-500/20 text-green-300 border-green-500/40';
  }
}

function AgentRow({ profile }: { profile: AgentQueueProfile }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-white">{profile.agentPersona}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${riskBadgeClass(profile.overflowRisk)}`}>
          {profile.overflowRisk}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        {profile.queueDepth} queued · {profile.activeTickets} active
      </p>
      {(profile.criticalQueued > 0 || profile.highQueued > 0) && (
        <p className="text-xs text-gray-500">
          {profile.criticalQueued} critical · {profile.highQueued} high
        </p>
      )}
      {(profile.overflowRisk === 'high' || profile.overflowRisk === 'medium') && (
        <p className="text-xs text-gray-300 italic">{profile.recommendation}</p>
      )}
    </div>
  );
}

export default function AgentQueueDepthModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentQueueDepthModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            Queue Depth Monitor
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {result.totalAgents} agents · {result.overloadedAgents} overloaded · avg {result.avgQueueDepth.toFixed(1)} queued
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
                <span className="text-sm">Monitoring agent queue depths...</span>
              </div>
            </div>
          ) : !result ? null : result.agentProfiles.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400 text-sm italic">No assigned tickets found for queue depth analysis.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.agentProfiles.map((profile) => (
                <AgentRow key={profile.agentPersona} profile={profile} />
              ))}
            </div>
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
