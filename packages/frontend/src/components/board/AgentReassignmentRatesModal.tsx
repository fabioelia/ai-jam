import React from 'react';
import { AgentReassignmentReport } from '../../api/mutations.js';

interface Props {
  report: AgentReassignmentReport;
  onClose: () => void;
}

const STABILITY_STYLES: Record<'stable' | 'moderate' | 'volatile' | 'critical', string> = {
  stable: 'bg-green-900/50 text-green-300 border border-green-700/50',
  moderate: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  volatile: 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
  critical: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

function getGaugeColor(pct: number): string {
  if (pct < 20) return 'bg-green-500';
  if (pct < 40) return 'bg-yellow-500';
  if (pct < 60) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function AgentReassignmentRatesModal({ report, onClose }: Props) {
  const avgPct = Math.min(100, report.summary.avgReassignmentAwayRate * 100);
  const gaugeColor = getGaugeColor(avgPct);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Reassignment Rate Analyzer</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {report.summary.totalAgents} agent{report.summary.totalAgents !== 1 ? 's' : ''} · {report.summary.totalReassignments} reassignments
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Stability Gauge */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400 font-medium">Avg Reassignment Away Rate</span>
              <span className="text-sm text-gray-300">{avgPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${gaugeColor}`}
                style={{ width: `${avgPct}%` }}
              />
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-gray-800/60 rounded-lg p-4">
            <p className="text-sm text-gray-300 italic">{report.aiSummary}</p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">{report.summary.totalAgents}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total Agents</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">{report.summary.totalReassignments}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total Reassignments</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">{(report.summary.avgReassignmentAwayRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-gray-400 mt-0.5">Avg Away Rate</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-sm font-bold text-white truncate">{report.summary.mostStableAgent ?? '—'}</div>
              <div className="text-xs text-gray-400 mt-0.5">Most Stable Agent</div>
            </div>
          </div>

          {report.agents.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              No reassignment data available
            </div>
          ) : (
            <>
              {/* Hotspots Table */}
              {report.hotspots.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Top Reassignment Paths</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-700">
                          <th className="pb-2 pr-4 font-medium">From Agent</th>
                          <th className="pb-2 pr-4 font-medium">To Agent</th>
                          <th className="pb-2 font-medium text-right">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {report.hotspots.map((hs, i) => (
                          <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                            <td className="py-2 pr-4 text-gray-300">{hs.fromPersona}</td>
                            <td className="py-2 pr-4 text-gray-300">{hs.toPersona}</td>
                            <td className="py-2 text-right text-white font-medium">{hs.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Agent List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Agent Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700">
                        <th className="pb-2 pr-4 font-medium">Persona</th>
                        <th className="pb-2 pr-4 font-medium text-right">Away Rate</th>
                        <th className="pb-2 pr-4 font-medium">Stability</th>
                        <th className="pb-2 pr-4 font-medium text-right">Avg Held (hrs)</th>
                        <th className="pb-2 font-medium text-right">Received In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {report.agents.map((agent) => (
                        <tr key={agent.agentPersona} className="hover:bg-gray-800/40 transition-colors">
                          <td className="py-2.5 pr-4">
                            <span className="font-medium text-white">{agent.agentPersona}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <span className={
                              agent.reassignmentAwayRate < 0.2
                                ? 'text-green-400'
                                : agent.reassignmentAwayRate < 0.4
                                  ? 'text-yellow-400'
                                  : agent.reassignmentAwayRate < 0.6
                                    ? 'text-orange-400'
                                    : 'text-red-400'
                            }>
                              {(agent.reassignmentAwayRate * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STABILITY_STYLES[agent.stabilityLevel]}`}>
                              {agent.stabilityLevel}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-right text-gray-300">
                            {agent.avgHeldDuration > 0 ? `${agent.avgHeldDuration}h` : '—'}
                          </td>
                          <td className="py-2.5 text-right text-gray-300">
                            {agent.ticketsReassignedIn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
