import type { SpecializationReport, AgentSpecialization, SpecializationStrength } from '../../api/mutations.js';

interface AgentSpecializationMapperModalProps {
  result: SpecializationReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function strengthBadgeClass(strength: SpecializationStrength): string {
  switch (strength) {
    case 'strong': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'moderate': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'generalist': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function strengthLabel(strength: SpecializationStrength): string {
  switch (strength) {
    case 'strong': return 'Specialist';
    case 'moderate': return 'Moderate';
    case 'generalist': return 'Generalist';
  }
}

function formatAvgTime(ms: number): string {
  return (ms / 3_600_000).toFixed(1) + 'h';
}

function AgentSpecializationRow({ profile }: { profile: AgentSpecialization }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-white">{profile.agentPersona}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${strengthBadgeClass(profile.specializationStrength)}`}>
          {strengthLabel(profile.specializationStrength)}
        </span>
      </div>

      {profile.topLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.topLabels.map((lbl) => (
            <span key={lbl} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {lbl}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Completed: {profile.totalCompleted} · Rate: {Math.round(profile.completionRate * 100)}% · Avg: {formatAvgTime(profile.avgCompletionTimeMs)}
      </p>

      <p className="text-xs text-gray-300 italic">{profile.recommendation}</p>
    </div>
  );
}

export default function AgentSpecializationMapperModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentSpecializationMapperModalProps) {
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
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Agent Specialization Map
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {result.totalAgents} agents · {result.specialistAgents} specialists · {result.generalistAgents} generalists
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
                <span className="text-sm">Mapping agent specializations...</span>
              </div>
            </div>
          ) : !result || result.agentProfiles.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No completed tickets found for specialization analysis.</p>
            </div>
          ) : (
            <>
              {/* AI Summary */}
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-purple-300 uppercase tracking-wider">AI Summary</span>
                </div>
                <p className="text-sm text-purple-100 leading-relaxed italic">{result.aiSummary}</p>
              </div>

              {/* Agent rows */}
              <div className="space-y-3">
                {result.agentProfiles.map((profile) => (
                  <AgentSpecializationRow key={profile.agentPersona} profile={profile} />
                ))}
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
