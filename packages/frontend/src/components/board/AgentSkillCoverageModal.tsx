import type { AgentSkillCoverageReport } from '../../api/mutations.js';

interface AgentSkillCoverageModalProps {
  projectId: string;
  result: AgentSkillCoverageReport | null;
  loading: boolean;
  onClose: () => void;
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'versatile': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'broad': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'focused': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default: return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  }
}

interface PriorityCoverage {
  urgent: number;
  high: number;
  medium: number;
  low: number;
}

interface ComplexityCoverage {
  simple: number;
  standard: number;
  complex: number;
}

function PrioritySpread({ coverage }: { coverage: PriorityCoverage }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {coverage.urgent > 0 && (
        <span className="flex items-center gap-1 text-xs text-red-300">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          {coverage.urgent}
        </span>
      )}
      {coverage.high > 0 && (
        <span className="flex items-center gap-1 text-xs text-orange-300">
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
          {coverage.high}
        </span>
      )}
      {coverage.medium > 0 && (
        <span className="flex items-center gap-1 text-xs text-blue-300">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          {coverage.medium}
        </span>
      )}
      {coverage.low > 0 && (
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
          {coverage.low}
        </span>
      )}
      {coverage.urgent === 0 && coverage.high === 0 && coverage.medium === 0 && coverage.low === 0 && (
        <span className="text-xs text-gray-600">—</span>
      )}
    </div>
  );
}

function ComplexitySpread({ coverage }: { coverage: ComplexityCoverage }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {coverage.simple > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">
          s:{coverage.simple}
        </span>
      )}
      {coverage.standard > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
          m:{coverage.standard}
        </span>
      )}
      {coverage.complex > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
          c:{coverage.complex}
        </span>
      )}
      {coverage.simple === 0 && coverage.standard === 0 && coverage.complex === 0 && (
        <span className="text-xs text-gray-600">—</span>
      )}
    </div>
  );
}

export default function AgentSkillCoverageModal({
  result,
  loading,
  onClose,
}: AgentSkillCoverageModalProps) {
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
            <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            AI Agent Skill Coverage
            {result && (
              <span className="text-sm font-normal text-sky-400/80 border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 rounded-full">
                avg score {result.summary.avgCoverageScore}
              </span>
            )}
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
                <span className="text-sm">Analyzing skill coverage...</span>
              </div>
            </div>
          ) : !result || result.agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-gray-400 text-sm">No skill coverage data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Total Agents</p>
                  <p className="text-sky-200 text-xl font-bold">{result.summary.totalAgents}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Avg Coverage Score</p>
                  <p className="text-sky-200 text-xl font-bold">{result.summary.avgCoverageScore}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Versatile Agents</p>
                  <p className="text-sky-200 text-xl font-bold">{result.summary.fullCoverageCount}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg px-4 py-3">
                  <p className="text-sky-400 text-xs font-medium uppercase tracking-wide mb-1">Specialist Agents</p>
                  <p className="text-sky-200 text-xl font-bold">{result.summary.specializationCount}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-center">Tickets</th>
                      <th className="px-4 py-3 text-left">Priority Spread</th>
                      <th className="px-4 py-3 text-left">Complexity Spread</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.agents.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{agent.agentRole}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{agent.totalTickets}</td>
                        <td className="px-4 py-3">
                          <PrioritySpread coverage={agent.priorityCoverage} />
                        </td>
                        <td className="px-4 py-3">
                          <ComplexitySpread coverage={agent.complexityCoverage} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-sky-500"
                                style={{ width: `${agent.coverageScore}%` }}
                              />
                            </div>
                            <span className="text-gray-200 font-mono text-xs">{agent.coverageScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${tierBadgeClass(agent.coverageTier)}`}>
                            {agent.coverageTier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gradient-to-r from-sky-900/20 to-sky-800/10 border border-sky-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-sky-300 font-semibold text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Analysis
                </h3>
                <p className="text-sky-100/80 text-sm leading-relaxed">{result.aiSummary}</p>
                {result.aiRecommendations.length > 0 && (
                  <ul className="space-y-1">
                    {result.aiRecommendations.map((rec, i) => (
                      <li key={i} className="text-sky-100/70 text-sm flex items-start gap-2">
                        <span className="text-sky-400 mt-0.5">•</span>
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
