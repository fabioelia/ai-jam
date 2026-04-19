import { useState } from 'react';
import { useSprintAnalysis } from '../../api/mutations.js';
import type { SprintAnalysis } from '../../api/mutations.js';

interface SprintIntelligenceModalProps {
  projectId: string;
  onClose: () => void;
}

export default function SprintIntelligenceModal({ projectId, onClose }: SprintIntelligenceModalProps) {
  const { analyze, loading, analysis } = useSprintAnalysis();
  const [analyzed, setAnalyzed] = useState(false);

  async function handleAnalyze() {
    await analyze(projectId);
    setAnalyzed(true);
  }

  function healthScoreColor(score: number) {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  }

  function healthScoreBg(score: number) {
    if (score >= 80) return 'bg-green-400/20 border-green-500/50';
    if (score >= 60) return 'bg-yellow-400/20 border-yellow-500/50';
    return 'bg-red-400/20 border-red-500/50';
  }

  function severityColor(severity: string) {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      default: return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span className="text-indigo-400">📊</span>
            Sprint Intelligence
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!analyzed ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">
                AI will analyze all active tickets and return a sprint health report with risks, bottlenecks, and recommendations.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? 'Analyzing...' : 'Analyze Sprint'}
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-sm">AI is analyzing your sprint...</p>
            </div>
          ) : analysis ? (
            <>
              {/* Health Score */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Health Score</h3>
                <div className={`inline-block rounded-xl border px-6 py-4 ${healthScoreBg(analysis.healthScore)}`}>
                  <span className={`text-5xl font-bold ${healthScoreColor(analysis.healthScore)}`}>
                    {analysis.healthScore}
                  </span>
                  <span className="text-gray-500 text-lg ml-1">/100</span>
                </div>
              </div>

              {/* Bottlenecks */}
              {analysis.bottlenecks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Bottlenecks</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.bottlenecks.map((b) => (
                      <div
                        key={b.status}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2"
                      >
                        <span className="text-sm text-white capitalize">{b.status.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-400">{b.count} tickets</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-amber-400">{b.avgDaysSinceUpdate}d avg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* At-Risk Tickets */}
              {analysis.risks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">At-Risk Tickets</h3>
                  <div className="space-y-2">
                    {analysis.risks.map((r) => (
                      <div
                        key={r.ticketId}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 hover:border-gray-600"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${severityColor(r.severity)}`}>
                            {r.severity}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">{r.ticketId}</span>
                        </div>
                        <p className="text-sm text-gray-200">{r.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Recommendations</h3>
                  <ul className="space-y-1.5">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5 shrink-0">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analyzed At */}
              <p className="text-xs text-gray-600">Analyzed at {new Date(analysis.analyzedAt).toLocaleString()}</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm text-center">No analysis data available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
