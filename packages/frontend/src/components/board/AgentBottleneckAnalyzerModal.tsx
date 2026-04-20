import type { BottleneckReport, StageBottleneck, AgentBottleneck } from '../../api/mutations.js';

interface AgentBottleneckAnalyzerModalProps {
  result: BottleneckReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function severityBadgeClass(severity: 'critical' | 'moderate' | 'low'): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'moderate': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'low': return 'bg-green-500/20 text-green-300 border-green-500/40';
  }
}

function scoreBadgeClass(score: number): string {
  if (score > 50) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (score >= 25) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
}

function formatDwell(ms: number): string {
  return (ms / 3_600_000).toFixed(1) + 'h';
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'in_progress': return 'In Progress';
    case 'review': return 'Review';
    case 'qa': return 'QA';
    case 'acceptance': return 'Acceptance';
    default: return stage;
  }
}

function StageRow({ sb }: { sb: StageBottleneck }) {
  return (
    <tr className="border-t border-gray-800">
      <td className="py-2 pr-4 text-sm text-gray-300">{stageLabel(sb.stage)}</td>
      <td className="py-2 pr-4 text-sm text-gray-300 tabular-nums">{formatDwell(sb.avgDwellMs)}</td>
      <td className="py-2 pr-4 text-sm text-gray-300 tabular-nums">{formatDwell(sb.maxDwellMs)}</td>
      <td className="py-2 pr-4 text-sm text-gray-300 tabular-nums">{sb.ticketCount}</td>
      <td className="py-2">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityBadgeClass(sb.bottleneckSeverity)}`}>
          {sb.bottleneckSeverity}
        </span>
      </td>
    </tr>
  );
}

function AgentRow({ ab }: { ab: AgentBottleneck }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-white">{ab.agentPersona}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${scoreBadgeClass(ab.bottleneckScore)}`}>
          {ab.bottleneckScore}%
        </span>
      </div>
      <p className="text-xs text-gray-400">
        Stalled: {ab.stalledTickets} · Total: {ab.totalAssigned}
      </p>
      <p className="text-xs text-gray-300 italic">{ab.recommendation}</p>
    </div>
  );
}

export default function AgentBottleneckAnalyzerModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentBottleneckAnalyzerModalProps) {
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
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Bottleneck Analyzer
            {result && !loading && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                {result.totalTickets} tickets · {result.stalledTickets} stalled · {result.criticalBottlenecks} critical stages
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
                <span className="text-sm">Analyzing pipeline bottlenecks...</span>
              </div>
            </div>
          ) : !result ? null : result.stalledTickets === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400 text-sm italic">No bottlenecks detected. Pipeline is flowing smoothly.</p>
            </div>
          ) : (
            <>
              {/* AI Summary */}
              <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-medium text-red-300 uppercase tracking-wider">AI Summary</span>
                </div>
                <p className="text-sm text-red-100 leading-relaxed italic">{result.aiSummary}</p>
              </div>

              {/* Pipeline Stages */}
              <div>
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Pipeline Stages</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-gray-500 pb-2 pr-4">Stage</th>
                        <th className="text-left text-xs text-gray-500 pb-2 pr-4">Avg Dwell</th>
                        <th className="text-left text-xs text-gray-500 pb-2 pr-4">Max Dwell</th>
                        <th className="text-left text-xs text-gray-500 pb-2 pr-4">Tickets</th>
                        <th className="text-left text-xs text-gray-500 pb-2">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.stageBottlenecks.map((sb) => (
                        <StageRow key={sb.stage} sb={sb} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agent Bottlenecks */}
              {result.agentBottlenecks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-200 mb-3">Agent Bottlenecks</h3>
                  <div className="space-y-3">
                    {result.agentBottlenecks.map((ab) => (
                      <AgentRow key={ab.agentPersona} ab={ab} />
                    ))}
                  </div>
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
