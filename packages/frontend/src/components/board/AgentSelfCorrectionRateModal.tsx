import type { AgentSelfCorrectionReport, AgentSelfCorrectionMetrics } from '../../api/mutations.js';

interface Props {
  result: AgentSelfCorrectionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentSelfCorrectionMetrics['correctionTier'], string> = {
  excellent: 'bg-purple-900/50 text-purple-300 border border-purple-700/50',
  good: 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50',
  improving: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  struggling: 'bg-red-900/50 text-red-400 border border-red-700/50',
};

export default function AgentSelfCorrectionRateModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  const summary = result
    ? {
        avgRate: result.projectAvgCorrectionRate,
        topSelfCorrector: result.topSelfCorrector,
        mostErrorProne: result.mostErrorProne,
        totalCorrections: result.totalCorrections,
      }
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Agent Self-Correction Rate Analyzer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing self-correction rates...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No self-correction data available.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Correction Rate</p>
                  <p className="text-purple-200 text-sm font-semibold">{summary!.avgRate}%</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Top Self-Corrector</p>
                  <p className="text-purple-200 text-sm font-semibold truncate">{summary!.topSelfCorrector ?? '—'}</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Most Error-Prone</p>
                  <p className="text-purple-200 text-sm font-semibold truncate">{summary!.mostErrorProne ?? '—'}</p>
                </div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg px-4 py-3">
                  <p className="text-purple-400 text-xs font-medium uppercase tracking-wide mb-1">Total Corrections</p>
                  <p className="text-purple-200 text-sm font-semibold">{summary!.totalCorrections}</p>
                </div>
              </div>

              {/* Agent table */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Correction Rate</th>
                      <th className="px-4 py-3 text-center">Revisions</th>
                      <th className="px-4 py-3 text-center">Self-Detected</th>
                      <th className="px-4 py-3 text-center">External</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_STYLES[agent.correctionTier]}`}>
                            {agent.correctionTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${agent.correctionScore}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-8 text-right">{agent.correctionScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.correctionRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.totalRevisions}</td>
                        <td className="px-4 py-3 text-center text-green-400 font-mono text-xs">{agent.selfDetectedErrors}</td>
                        <td className="px-4 py-3 text-center text-red-400 font-mono text-xs">{agent.externallyDetectedErrors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
