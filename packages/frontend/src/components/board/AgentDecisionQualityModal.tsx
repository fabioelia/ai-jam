import type { AgentDecisionQuality, DecisionQualityReport, QualityRating } from '../../api/mutations.js';

interface AgentDecisionQualityModalProps {
  result: DecisionQualityReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function ratingBadgeClass(rating: QualityRating): string {
  switch (rating) {
    case 'excellent': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'good': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'needs_improvement': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'poor': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function ratingLabel(rating: QualityRating): string {
  switch (rating) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'needs_improvement': return 'Needs Improvement';
    case 'poor': return 'Poor';
  }
}

function qualityBarColor(rating: QualityRating): string {
  switch (rating) {
    case 'excellent': return 'bg-green-500';
    case 'good': return 'bg-blue-500';
    case 'needs_improvement': return 'bg-yellow-500';
    case 'poor': return 'bg-red-500';
  }
}

function AgentQualityRow({ agent }: { agent: AgentDecisionQuality }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-white">{agent.agentPersona}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ratingBadgeClass(agent.rating)}`}>
          {ratingLabel(agent.rating)}
        </span>
      </div>
      {/* Quality score bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${qualityBarColor(agent.rating)}`}
            style={{ width: `${Math.max(0, Math.min(100, agent.qualityScore))}%` }}
          />
        </div>
        <span className="text-xs text-gray-300 w-12 text-right">{agent.qualityScore}%</span>
      </div>
      <p className="text-xs text-gray-400">
        Quality Score: {agent.qualityScore}% · Regressions: {agent.regressionCount}/{agent.totalTickets} tickets
      </p>
      <p className="text-xs text-gray-300 italic">{agent.recommendation}</p>
    </div>
  );
}

export default function AgentDecisionQualityModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentDecisionQualityModalProps) {
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
            <svg
              className="w-5 h-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Agent Decision Quality
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                {result.totalAgents} agents · {result.poorQualityAgents} poor quality · avg {result.avgQualityScore.toFixed(1)}% quality
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">Analyzing agent decision quality...</span>
              </div>
            </div>
          ) : !result ? null : (
            <>
              {/* AI Summary */}
              {result.aiSummary && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>
                </div>
              )}

              {/* Warning bar */}
              {result.poorQualityAgents > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-2">
                  <span className="text-sm text-red-300 font-medium">
                    ⚠ {result.poorQualityAgents} agent(s) have poor decision quality — review and retrain
                  </span>
                </div>
              )}

              {/* Agent rows */}
              {result.agentQualities.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-400 text-sm italic">
                    No agent quality data available — assign tickets to begin tracking.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.agentQualities.map((agent, i) => (
                    <AgentQualityRow key={`${agent.agentPersona}-${i}`} agent={agent} />
                  ))}
                </div>
              )}
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
