import type { AgentPerformanceTrend, PerformanceTrendReport } from '../../api/mutations.js';

interface AgentPerformanceTrendModalProps {
  result: PerformanceTrendReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

type TrendDirection = AgentPerformanceTrend['trendDirection'];

function trendBadgeClass(dir: TrendDirection): string {
  switch (dir) {
    case 'declining': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'improving': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'stable': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    case 'insufficient_data': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  }
}

function trendLabel(dir: TrendDirection): string {
  switch (dir) {
    case 'declining': return 'Declining';
    case 'improving': return 'Improving';
    case 'stable': return 'Stable';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

function DeltaIndicator({ value, positiveIsGood }: { value: number; positiveIsGood: boolean }) {
  const isGood = positiveIsGood ? value > 0 : value < 0;
  const isNeutral = Math.abs(value) < 0.001;
  const color = isNeutral ? 'text-gray-400' : isGood ? 'text-green-400' : 'text-red-400';
  const arrow = isNeutral ? '–' : value > 0 ? '▲' : '▼';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {(Math.abs(value) * 100).toFixed(1)}%
    </span>
  );
}

function AgentTrendRow({ agent }: { agent: AgentPerformanceTrend }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-white">{agent.agentName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${trendBadgeClass(agent.trendDirection)}`}>
          {trendLabel(agent.trendDirection)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <p className="text-gray-400 font-medium">Recent (7d)</p>
          <p className="text-gray-300">
            Completion: {(agent.recent.completionRate * 100).toFixed(0)}%
            <span className="ml-2"><DeltaIndicator value={agent.completionRateDelta} positiveIsGood={true} /></span>
          </p>
          <p className="text-gray-300">
            Stall: {(agent.recent.stallRate * 100).toFixed(0)}%
            <span className="ml-2"><DeltaIndicator value={agent.stallRateDelta} positiveIsGood={false} /></span>
          </p>
          <p className="text-gray-500">Vol: {agent.recent.ticketVolume}</p>
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 font-medium">Baseline (8–30d)</p>
          <p className="text-gray-300">Completion: {(agent.baseline.completionRate * 100).toFixed(0)}%</p>
          <p className="text-gray-300">Stall: {(agent.baseline.stallRate * 100).toFixed(0)}%</p>
          <p className="text-gray-500">Vol: {agent.baseline.ticketVolume}</p>
        </div>
      </div>
      <p className="text-xs text-gray-300 italic">{agent.recommendation}</p>
    </div>
  );
}

export default function AgentPerformanceTrendModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentPerformanceTrendModalProps) {
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
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Agent Performance Trends
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                {result.totalAgents} agents · {result.decliningAgents} declining · {result.improvingAgents} improving
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
                <span className="text-sm">Analyzing performance trends...</span>
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

              {/* Alert bar */}
              {result.decliningAgents > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-2">
                  <span className="text-sm text-red-300 font-medium">
                    ⚠ {result.decliningAgents} agent(s) showing declining performance
                  </span>
                </div>
              )}

              {/* Agent rows */}
              {result.agentTrends.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-400 text-sm italic">
                    No agent performance data found for this period.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.agentTrends.map((agent, i) => (
                    <AgentTrendRow key={`${agent.agentName}-${i}`} agent={agent} />
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
