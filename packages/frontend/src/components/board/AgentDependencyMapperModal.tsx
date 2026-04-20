import type { AgentDependencyEdge, AgentDependencyMapReport } from '../../api/mutations.js';

interface AgentDependencyMapperModalProps {
  result: AgentDependencyMapReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

type EdgeSeverity = AgentDependencyEdge['severity'];

function severityBadgeClass(s: EdgeSeverity): string {
  switch (s) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  }
}

function severityLabel(s: EdgeSeverity): string {
  switch (s) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'moderate': return 'Moderate';
    case 'low': return 'Low';
  }
}

function EdgeRow({ edge }: { edge: AgentDependencyEdge }) {
  return (
    <div className={`border rounded-lg p-3 space-y-2 ${edge.severity === 'critical' ? 'bg-red-900/10 border-red-800/40' : 'bg-gray-800/50 border-gray-700'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm text-white">{edge.blockingAgent}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span className="font-semibold text-sm text-purple-300">{edge.waitingAgent}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityBadgeClass(edge.severity)}`}>
          {severityLabel(edge.severity)}
        </span>
        <span className="text-xs text-gray-500 ml-auto">Score: {edge.blockingScore}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>{edge.blockedTickets} blocked ticket{edge.blockedTickets !== 1 ? 's' : ''}</span>
        <span>{edge.totalBlockingTickets} total blocking</span>
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{edge.recommendation}</p>
    </div>
  );
}

export default function AgentDependencyMapperModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentDependencyMapperModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <h2 className="text-base font-semibold text-white">Agent Dependency Map</h2>
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
              <svg className="w-8 h-8 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
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
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{result.totalEdges}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Total Edges</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${result.criticalEdges > 0 ? 'text-red-400' : 'text-green-400'}`}>{result.criticalEdges}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Critical</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{result.independentAgents}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Independent</div>
                </div>
              </div>

              {/* AI Summary */}
              <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">AI Analysis</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{result.aiSummary}</p>
              </div>

              {/* Critical warning bar */}
              {result.criticalEdges > 0 && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-2.5">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-red-300 font-medium">
                    {result.criticalEdges} critical {result.criticalEdges === 1 ? 'dependency' : 'dependencies'} blocking agent flow — immediate action required
                  </span>
                </div>
              )}

              {/* Dependency edges */}
              {result.agentDependencyEdges.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <svg className="w-10 h-10 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-300 font-medium">No cross-agent dependencies</p>
                  <p className="text-xs text-gray-500">All agents are operating independently</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Dependencies</h4>
                  {result.agentDependencyEdges.map((edge) => (
                    <EdgeRow key={`${edge.blockingAgent}::${edge.waitingAgent}`} edge={edge} />
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
