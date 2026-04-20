import type { SkillProfileReport, AgentSkillProfile } from '../../api/mutations.js';

interface AgentSkillProfilerModalProps {
  result: SkillProfileReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function proficiencyBadgeClass(tier: AgentSkillProfile['proficiencyTier']): string {
  switch (tier) {
    case 'expert': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'proficient': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'developing': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

function priorityChipClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export default function AgentSkillProfilerModal({ result, isOpen, loading, onClose }: AgentSkillProfilerModalProps) {
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
            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Agent Skill Profiles
            {result?.topExpert && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1">
                <span>&#9733;</span> {result.topExpert}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Profiling agent skills...</span>
              </div>
            </div>
          ) : !result || result.profiles.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500 text-sm italic">No agent data yet — assign tickets to start profiling.</p>
            </div>
          ) : (
            <>
              {/* Profile Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.profiles.map((profile) => {
                  const breakdown = profile.priorityBreakdown;
                  const nonZeroPriorities = (['critical', 'high', 'medium', 'low'] as const).filter(
                    (p) => breakdown[p] > 0,
                  );
                  return (
                    <div
                      key={profile.agentName}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3"
                    >
                      {/* Agent Name + Proficiency Tier */}
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-sm">{profile.agentName}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${proficiencyBadgeClass(profile.proficiencyTier)}`}>
                          {profile.proficiencyTier}
                        </span>
                      </div>

                      {/* Complexity Score */}
                      <div className="text-center">
                        <span className="text-3xl font-bold text-white">{profile.complexityScore}</span>
                        <p className="text-xs text-gray-500 mt-0.5">complexity score</p>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Completion</p>
                          <p className="text-sm font-semibold text-green-300">{profile.completionRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Avg Story Pts</p>
                          <p className="text-sm font-semibold text-purple-300">{profile.avgStoryPoints}</p>
                        </div>
                      </div>

                      {/* Priority Breakdown Chips */}
                      {nonZeroPriorities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {nonZeroPriorities.map((p) => (
                            <span
                              key={p}
                              className={`text-xs px-2 py-0.5 rounded-full border capitalize ${priorityChipClass(p)}`}
                            >
                              {p}: {breakdown[p]}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Specialization */}
                      {profile.specialization && (
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${priorityChipClass(profile.specialization)}`}>
                            Specializes in: {profile.specialization}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* AI Insight */}
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">AI Insight</span>
                </div>
                <p className="text-sm text-indigo-200 leading-relaxed">{result.insight}</p>
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
