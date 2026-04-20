import type { AgentInstructionComplianceReport } from '../../api/mutations.js';

interface Props {
  result: AgentInstructionComplianceReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<string, string> = {
  exemplary: 'bg-green-900/50 text-green-300 border border-green-700/50',
  compliant: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  partial: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  defiant: 'bg-red-900/50 text-red-400 border border-red-700/50',
};

const SEVERITY_STYLES: Record<string, string> = {
  minor: 'bg-green-900/30 text-green-400',
  moderate: 'bg-yellow-900/30 text-yellow-400',
  major: 'bg-orange-900/30 text-orange-400',
  critical: 'bg-red-900/30 text-red-400',
};

export default function AgentInstructionComplianceModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

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
            <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Agent Instruction Compliance Analyzer
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing instruction compliance...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">No compliance data available.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Compliance Score</p>
                  <p className="text-sky-200 text-2xl font-bold">{result.summary.avgComplianceScore}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Most Compliant</p>
                  <p className="text-sky-200 text-sm font-semibold truncate">{result.summary.mostCompliant || '—'}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Least Compliant</p>
                  <p className="text-sky-200 text-sm font-semibold truncate">{result.summary.leastCompliant || '—'}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Exemplary Agents</p>
                  <p className="text-sky-200 text-2xl font-bold">{result.summary.exemplaryAgents}</p>
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
                      <th className="px-4 py-3 text-center">Compliance Rate</th>
                      <th className="px-4 py-3 text-center">Total Instructions</th>
                      <th className="px-4 py-3 text-center">Violations</th>
                      <th className="px-4 py-3 text-center">Violation Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_STYLES[agent.complianceTier] ?? 'bg-gray-800 text-gray-400 border-gray-600'}`}>
                            {agent.complianceTier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                              <div className="h-2 bg-sky-500 rounded-full" style={{ width: `${agent.complianceScore}%` }} />
                            </div>
                            <span className="text-gray-300 font-mono text-xs w-8 text-right">{agent.complianceScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.complianceRate}%</td>
                        <td className="px-4 py-3 text-center text-gray-300 font-mono text-xs">{agent.totalInstructions}</td>
                        <td className="px-4 py-3 text-center text-red-400 font-mono text-xs">{agent.violationCount}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${SEVERITY_STYLES[agent.avgViolationSeverity] ?? ''}`}>
                            {agent.avgViolationSeverity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Summary */}
              {(result.aiSummary || (result.aiRecommendations && result.aiRecommendations.length > 0)) && (
                <div className="bg-gradient-to-r from-sky-900/20 to-blue-900/20 border border-sky-700/30 rounded-lg px-5 py-4 space-y-3">
                  {result.aiSummary && (
                    <div>
                      <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-2">AI Summary</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{result.aiSummary}</p>
                    </div>
                  )}
                  {result.aiRecommendations && result.aiRecommendations.length > 0 && (
                    <div>
                      <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {result.aiRecommendations.map((rec, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-sky-400 shrink-0">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
