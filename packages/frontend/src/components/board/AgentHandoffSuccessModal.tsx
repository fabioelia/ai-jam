import type { HandoffPair, HandoffSuccessReport } from '../../api/mutations.js';

interface AgentHandoffSuccessModalProps {
  result: HandoffSuccessReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function ratingBadgeClass(rating: HandoffPair['rating']): string {
  switch (rating) {
    case 'excellent': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'good': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'poor': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
}

function ratingLabel(rating: HandoffPair['rating']): string {
  return rating.charAt(0).toUpperCase() + rating.slice(1);
}

function PairRow({ pair }: { pair: HandoffPair }) {
  const pct = (pair.successRate * 100).toFixed(1);
  const barColor =
    pair.rating === 'excellent' ? 'bg-green-500' :
    pair.rating === 'good' ? 'bg-blue-500' :
    pair.rating === 'poor' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-white">{pair.fromAgent} → {pair.toAgent}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ratingBadgeClass(pair.rating)}`}>
          {ratingLabel(pair.rating)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Success rate</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Success: {pair.successfulHandoffs}/{pair.totalHandoffs} · Stalled: {pair.stalledHandoffs}
      </p>
      <p className="text-xs text-gray-300 italic">{pair.recommendation}</p>
    </div>
  );
}

export default function AgentHandoffSuccessModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentHandoffSuccessModalProps) {
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
          <div>
            <h2 className="text-white font-semibold text-lg flex items-center gap-3">
              <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Agent Handoff Success Tracker
            </h2>
            {result && (
              <p className="text-xs text-gray-400 mt-1">
                {result.totalPairs} agent pairs · {result.criticalPairs} critical · avg {(result.avgSuccessRate * 100).toFixed(1)}% success
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-8 h-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-400">Analyzing agent handoff patterns...</p>
            </div>
          )}

          {!loading && result && (
            <>
              {/* AI Summary */}
              {result.aiSummary && (
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-300 italic">{result.aiSummary}</p>
                </div>
              )}

              {/* Warning bar */}
              {result.criticalPairs > 0 && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-2">
                  <span className="text-red-400">⚠</span>
                  <span className="text-sm text-red-300 font-medium">
                    {result.criticalPairs} handoff pair{result.criticalPairs === 1 ? '' : 's'} have critical failure rates
                  </span>
                </div>
              )}

              {/* Pairs */}
              {result.pairs.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <svg className="w-10 h-10 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-300 font-medium">No cross-agent handoff data — assign tickets within epics to track handoff success.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Agent Pairs</h4>
                  {result.pairs.map(pair => (
                    <PairRow key={`${pair.fromAgent}::${pair.toAgent}`} pair={pair} />
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
