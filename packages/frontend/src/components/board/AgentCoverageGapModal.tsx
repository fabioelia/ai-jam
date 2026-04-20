import type { CoverageArea, CoverageGapReport } from '../../api/mutations.js';

interface AgentCoverageGapModalProps {
  result: CoverageGapReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

type GapSeverity = CoverageArea['gapSeverity'];

function severityBadgeClass(s: GapSeverity): string {
  switch (s) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  }
}

function severityLabel(s: GapSeverity): string {
  switch (s) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'moderate': return 'Moderate';
    case 'low': return 'Low';
  }
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const ringColor = score >= 80 ? 'stroke-green-400' : score >= 50 ? 'stroke-yellow-400' : 'stroke-red-400';
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-700" />
          <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={ringColor} />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${color}`}>{score}%</span>
      </div>
      <div>
        <div className="text-sm font-semibold text-white">Coverage Score</div>
        <div className={`text-xs ${color}`}>{score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical'}</div>
      </div>
    </div>
  );
}

function AreaRow({ area }: { area: CoverageArea }) {
  const isUncovered = area.agentsCovering === 0;
  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isUncovered ? 'bg-red-900/10 border-red-800/40' : 'bg-gray-800/50 border-gray-700'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-mono uppercase">{area.areaType}</span>
        <span className="font-semibold text-sm text-white">{area.areaName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityBadgeClass(area.gapSeverity)}`}>
          {severityLabel(area.gapSeverity)}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>{area.activeTickets} active ticket{area.activeTickets !== 1 ? 's' : ''}</span>
        <span>{area.agentsCovering} agent{area.agentsCovering !== 1 ? 's' : ''} covering</span>
        {area.lastAgentActivity && (
          <span>Last touch: {new Date(area.lastAgentActivity).toLocaleDateString()}</span>
        )}
        {!area.lastAgentActivity && <span className="text-red-400">No agent activity</span>}
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{area.recommendation}</p>
    </div>
  );
}

function AreaSection({ title, areas }: { title: string; areas: CoverageArea[] }) {
  if (areas.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h4>
      {areas.map((a) => <AreaRow key={`${a.areaType}-${a.areaId}`} area={a} />)}
    </div>
  );
}

export default function AgentCoverageGapModal({ result, isOpen, loading, onClose }: AgentCoverageGapModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h2 className="text-base font-semibold text-white">Agent Coverage Gap Monitor</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-8 h-8 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-400">Analyzing coverage gaps...</p>
            </div>
          )}

          {!loading && !result && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-red-400">Failed to analyze coverage gaps.</p>
            </div>
          )}

          {!loading && result && (
            <>
              {/* Score + Stats */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                <ScoreRing score={result.coverageScore} />
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">{result.coveredAreas}/{result.totalAreas} areas covered</span>
                  {result.criticalGaps > 0 && (
                    <span className="text-red-400 font-medium">{result.criticalGaps} critical gap{result.criticalGaps !== 1 ? 's' : ''}</span>
                  )}
                  {result.uncoveredAreas > 0 && (
                    <span className="text-gray-400">{result.uncoveredAreas} total gap{result.uncoveredAreas !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {result.aiSummary && (
                  <p className="text-xs text-gray-400 italic leading-relaxed">{result.aiSummary}</p>
                )}
              </div>

              {/* Empty state */}
              {result.areas.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-green-400 font-medium">All board areas have active agent coverage.</p>
                </div>
              )}

              {/* Gap Areas grouped by type */}
              {result.areas.length > 0 && (
                <div className="space-y-4">
                  <AreaSection title="Status Areas" areas={result.areas.filter((a) => a.areaType === 'status')} />
                  <AreaSection title="Epic Areas" areas={result.areas.filter((a) => a.areaType === 'epic')} />
                  <AreaSection title="Label Areas" areas={result.areas.filter((a) => a.areaType === 'label')} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
