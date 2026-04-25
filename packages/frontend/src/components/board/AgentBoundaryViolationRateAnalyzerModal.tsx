import React from 'react';
import { AgentBoundaryViolationRateAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentBoundaryViolationRateAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function riskBadge(risk: string) {
  if (risk === 'low') return 'bg-green-500/20 border-green-500/30 text-green-400';
  if (risk === 'medium') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  if (risk === 'high') return 'bg-orange-500/20 border-orange-500/30 text-orange-400';
  return 'bg-red-500/20 border-red-500/30 text-red-400';
}

function pct(v: number) { return Math.round(v * 100); }

export function AgentBoundaryViolationRateAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            Boundary Violation Rate Analyzer
            {result && (
              <span className="text-sm font-normal text-pink-400/80 border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 rounded-full">
                {result.metrics.length} agents
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
                <span className="text-sm">Analyzing boundary violations...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-gray-400 text-sm">No boundary violation data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="bg-pink-900/20 border border-pink-500/30 rounded-lg px-4 py-3">
                  <p className="text-pink-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Compliance</p>
                  <p className="text-pink-200 text-2xl font-bold">{pct(result.fleetAvgComplianceScore)}%</p>
                </div>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-3">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Agents</p>
                  <p className="text-white text-2xl font-bold">{result.metrics.length}</p>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-xs font-medium uppercase tracking-wide mb-1">Compliant</p>
                  <p className="text-green-200 text-2xl font-bold">{result.compliantAgents}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Critical Risk</p>
                  <p className="text-red-200 text-2xl font-bold">{result.criticalRiskAgents}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Agent</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Violation Rate</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Violations / Actions</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Compliance</th>
                      <th className="text-left text-gray-400 font-medium pb-2 pr-4">Top Violation</th>
                      <th className="text-left text-gray-400 font-medium pb-2">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.metrics.map((m) => (
                      <tr key={m.agentId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 pr-4 text-white font-medium truncate max-w-[120px]">{m.agentName}</td>
                        <td className="py-3 pr-4 text-gray-300">{m.boundaryViolationRate.toFixed(1)}/100</td>
                        <td className="py-3 pr-4 text-gray-300">{m.violationCount} / {m.totalActions}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: `${pct(m.complianceScore)}%` }} />
                            </div>
                            <span className="text-gray-300 text-xs w-10">{pct(m.complianceScore)}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-400 text-xs truncate max-w-[120px]">
                          {m.violationTypes.length > 0 ? m.violationTypes[0].type.replace(/_/g, ' ') : '—'}
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${riskBadge(m.riskLevel)}`}>
                            {m.riskLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
