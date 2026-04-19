import { useState } from 'react';
import { useBlockerAnalysis } from '../../api/mutations.js';
import type { DependencyAnalysisResult } from '../../api/mutations.js';

interface BlockerDependencyModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function BlockerDependencyModal({ projectId, projectName, onClose }: BlockerDependencyModalProps) {
  const { analyze, loading, result, setResult } = useBlockerAnalysis();
  const [started, setStarted] = useState(false);

  async function handleAnalyze() {
    setStarted(true);
    await analyze(projectId);
  }

  function riskLevelColor(level: string) {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
    }
  }

  function confidenceLabel(c: string) {
    return c?.charAt(0).toUpperCase() + c?.slice(1);
  }

  function confidenceOrder(e: { confidence: string }) {
    return e.confidence === 'high' ? 0 : e.confidence === 'medium' ? 1 : 2;
  }

  function getTicketTitle(id: string, result: DependencyAnalysisResult): string {
    for (const b of result.allBlockers) {
      if (b.ticketId === id) return b.ticketTitle;
    }
    const edge = result.edges.find(e => e.fromTicketId === id || e.toTicketId === id);
    if (edge) {
      if (edge.fromTicketId === id) return edge.reason.match(/"([^"]+)"/)?.[1] || id.substring(0, 8);
    }
    return id.substring(0, 8);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Dependency & Blocker Analysis
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!started ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 3m0 0l4.5 18M3 3h18m0 0l-4.5 18M9 9l3 6m3-6l3 6" />
              </svg>
              <p className="text-gray-400 text-sm mb-2 max-w-sm mx-auto">
                AI will analyze all {result?.totalTickets || 'active'} tickets in <strong className="text-gray-200">{projectName}</strong> and identify hidden dependencies and blocker risks.
              </p>
              <p className="text-gray-500 text-xs mb-4">
                Uses keyword heuristics + AI cross-reference to find dependencies.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Analyzing Dependencies...' : 'Analyze Dependencies'}
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">Scanning ticket dependencies...</p>
            </div>
          ) : result ? (
            <>
              {/* Risk Summary */}
              {result.riskSummary && result.riskSummary !== 'No dependencies detected' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-yellow-300 text-sm font-medium mb-1">Risk Summary</p>
                      <p className="text-yellow-200/80 text-sm">{result.riskSummary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Critical Blockers */}
              {result.criticalBlockers.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Critical Blockers ({result.criticalBlockers.length})
                  </h3>
                  <div className="space-y-3">
                    {result.criticalBlockers.map((blocker) => (
                      <div key={blocker.ticketId} className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-white font-medium text-sm">{blocker.ticketTitle}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${riskLevelColor(blocker.riskLevel)}`}>
                            {blocker.riskLevel.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full transition-all"
                                style={{ width: `${blocker.blockerScore}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-red-400 text-xs font-medium">
                            Score: {blocker.blockerScore}/100
                          </span>
                          <span className="text-gray-400 text-xs">
                            Blocks {blocker.blocksCount} ticket{blocker.blocksCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Blockers */}
              {result.allBlockers.length > result.criticalBlockers.length && (
                <div>
                  <h3 className="text-white font-semibold mb-3">All Tickets with Dependencies</h3>
                  <div className="space-y-2">
                    {result.allBlockers
                      .filter(b => !result.criticalBlockers.find(c => c.ticketId === b.ticketId))
                      .map((blocker) => (
                        <div key={blocker.ticketId} className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-200 text-sm truncate">{blocker.ticketTitle}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${riskLevelColor(blocker.riskLevel)}`}>
                              {blocker.riskLevel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-gray-400 text-xs">
                              Score: {blocker.blockerScore}
                            </span>
                            <span className="text-gray-400 text-xs">
                              Blocks {blocker.blocksCount}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Dependency List */}
              {result.edges.length > 0 ? (
                <div>
                  <h3 className="text-white font-semibold mb-3">Dependencies ({result.edges.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400 text-xs">
                          <th className="text-left py-2 pr-4 font-medium">Ticket</th>
                          <th className="text-left py-2 pr-4 font-medium">Depends On</th>
                          <th className="text-left py-2 pr-4 font-medium">Reason</th>
                          <th className="text-left py-2 font-medium">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.edges]
                          .sort((a, b) => confidenceOrder(a) - confidenceOrder(b))
                          .map((edge, i) => (
                            <tr key={i} className="border-b border-gray-800/50">
                              <td className="py-2.5 pr-4 text-gray-200 text-xs truncate max-w-[150px]" title={getTicketTitle(edge.fromTicketId, result)}>
                                {getTicketTitle(edge.fromTicketId, result)}
                              </td>
                              <td className="py-2.5 pr-4 text-gray-200 text-xs truncate max-w-[150px]" title={getTicketTitle(edge.toTicketId, result)}>
                                {getTicketTitle(edge.toTicketId, result)}
                              </td>
                              <td className="py-2.5 pr-4 text-gray-400 text-xs max-w-[250px]">{edge.reason}</td>
                              <td className="py-2.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  edge.confidence === 'high' ? 'bg-green-500/20 text-green-300' :
                                  edge.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-gray-700 text-gray-400'
                                }`}>
                                  {confidenceLabel(edge.confidence)}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : result.dependencyCount === 0 && result.allBlockers.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-green-400 text-sm font-medium">No dependencies detected</p>
                  <p className="text-gray-400 text-xs mt-1">Sprint looks clean!</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={() => { setResult(null); setStarted(false); onClose(); }}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
