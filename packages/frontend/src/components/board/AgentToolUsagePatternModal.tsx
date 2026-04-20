import type { AgentToolUsagePatternReport, AgentToolUsageMetrics } from '../../api/mutations.js';

interface AgentToolUsagePatternModalProps {
  result: AgentToolUsagePatternReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

function patternBadgeClass(pattern: AgentToolUsageMetrics['usagePattern']): string {
  switch (pattern) {
    case 'diverse': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'focused': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'minimal': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
  }
}

export default function AgentToolUsagePatternModal({
  result,
  isOpen,
  loading,
  onClose,
}: AgentToolUsagePatternModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
            AI Agent Tool Usage Pattern Analyzer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Analyzing tool usage patterns...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-gray-400 text-sm">No tool usage data found for this project.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-violet-900/20 border border-violet-500/30 rounded-lg px-4 py-3">
                  <p className="text-violet-400 text-xs font-medium uppercase tracking-wide mb-1">Total Tool Calls</p>
                  <p className="text-violet-200 text-sm font-semibold">{result.systemTotalToolCalls}</p>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-4 py-3">
                  <p className="text-blue-400 text-xs font-medium uppercase tracking-wide mb-1">Most Used Tool</p>
                  <p className="text-blue-200 text-sm font-semibold truncate">{result.mostUsedToolSystem}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Diversity Score</p>
                  <p className="text-green-200 text-sm font-semibold">{result.avgDiversityScore}%</p>
                </div>
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Diverse Agents</p>
                  <p className="text-teal-200 text-sm font-semibold">{result.diverseAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Total Calls</th>
                      <th className="px-4 py-3 text-center">Unique Tools</th>
                      <th className="px-4 py-3 text-center">Top Tool</th>
                      <th className="px-4 py-3 text-center">Diversity %</th>
                      <th className="px-4 py-3 text-center">Pattern</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.personaId}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalToolCalls}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.uniqueToolsUsed}</td>
                        <td className="px-4 py-3 text-center text-gray-400 text-xs">{agent.mostUsedTool}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${Math.min(agent.toolDiversity, 100)}%` }} />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.toolDiversity}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${patternBadgeClass(agent.usagePattern)}`}>
                            {agent.usagePattern}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gradient-to-br from-violet-900/20 to-blue-900/20 border border-violet-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-violet-300 font-semibold text-sm">AI Summary</h3>
                <p className="text-violet-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                {result.recommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-violet-100/70 text-sm flex items-start gap-2">
                        <span className="text-violet-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end">
          <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
