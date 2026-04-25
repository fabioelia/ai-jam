import React from 'react';
import { AgentSpecializationDriftAnalyzerReport } from '../../api/mutations';

interface Props {
  result: AgentSpecializationDriftAnalyzerReport | null;
  loading: boolean;
  onClose: () => void;
}

function riskBadge(risk: string) {
  if (risk === 'critical') return 'bg-red-500/20 border-red-500/30 text-red-400';
  if (risk === 'high') return 'bg-orange-500/20 border-orange-500/30 text-orange-400';
  if (risk === 'medium') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
  return 'bg-green-500/20 border-green-500/30 text-green-400';
}

export function AgentSpecializationDriftAnalyzerModal({ result, loading, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            Specialization Drift Analyzer
            {result && (
              <span className="text-sm font-normal text-teal-400/80 border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 rounded-full">
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
                <span className="text-sm">Analyzing specialization drift...</span>
              </div>
            </div>
          ) : !result || result.metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-gray-400 text-sm">No specialization drift data found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-teal-900/20 border border-teal-500/30 rounded-lg px-4 py-3">
                  <p className="text-teal-400 text-xs font-medium uppercase tracking-wide mb-1">Fleet Avg Drift Score</p>
                  <p className="text-teal-200 text-2xl font-bold">{result.fleetAvgDriftScore.toFixed(3)}</p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">High/Critical Drift Agents</p>
                  <p className="text-red-200 text-xl font-bold flex items-center gap-2">
                    {result.criticalDriftAgents}
                    {result.criticalDriftAgents > 0 && (
                      <span className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded-full">needs review</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-center">Drift Score</th>
                      <th className="px-4 py-3 text-center">Specialty</th>
                      <th className="px-4 py-3 text-center">On-Specialty %</th>
                      <th className="px-4 py-3 text-center">Drifted Domains</th>
                      <th className="px-4 py-3 text-center">Drift Velocity</th>
                      <th className="px-4 py-3 text-center">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.metrics.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{m.agentName}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${m.specializationDriftScore >= 0.7 ? 'bg-red-500' : m.specializationDriftScore >= 0.4 ? 'bg-orange-500' : m.specializationDriftScore >= 0.2 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${m.specializationDriftScore * 100}%` }}
                              />
                            </div>
                            <span className="text-teal-400">{m.specializationDriftScore.toFixed(3)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs bg-teal-500/10 border border-teal-500/30 text-teal-400 px-2 py-0.5 rounded-full">{m.primarySpecialty}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{(m.onSpecialtyTaskRatio * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-center">
                          {m.driftedDomains.length === 0 ? (
                            <span className="text-gray-500 text-xs">none</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {m.driftedDomains.map((d, j) => (
                                <span key={j} className="text-xs bg-orange-500/10 border border-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded-full">{d}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">{m.driftVelocity > 0 ? '+' : ''}{m.driftVelocity.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${riskBadge(m.riskLevel)}`}>{m.riskLevel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
