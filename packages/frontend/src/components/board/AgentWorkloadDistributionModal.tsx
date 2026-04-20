import React from 'react';
import { WorkloadDistributionReport, AgentWorkloadDistribution } from '../../api/mutations.js';

interface Props {
  result: WorkloadDistributionReport | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const PATTERN_STYLES = {
  burst: 'bg-red-900/50 text-red-300 border border-red-700/50',
  mixed: 'bg-amber-900/50 text-amber-300 border border-amber-700/50',
  steady: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50',
};

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

function StatsBar({ result }: { result: WorkloadDistributionReport }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Agents', value: result.summary.totalAgents, color: 'text-violet-400' },
        { label: 'Peak System Hour', value: formatHour(result.summary.peakSystemHour), color: 'text-white' },
        { label: 'Burstiest', value: result.summary.burstiestAgent ?? '—', color: 'text-red-400' },
        { label: 'Steadiest', value: result.summary.steadiestAgent ?? '—', color: 'text-emerald-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-base font-bold ${color} truncate`}>{value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function HourBar({ buckets }: { buckets: number[] }) {
  const max = Math.max(...buckets, 1);
  return (
    <div className="flex items-end gap-px h-8 w-full">
      {buckets.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-violet-500/70 rounded-sm"
          style={{ height: `${Math.round((v / max) * 100)}%`, minHeight: v > 0 ? 2 : 0 }}
          title={`${formatHour(i)}: ${v}`}
        />
      ))}
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentWorkloadDistribution }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-medium text-white truncate">{agent.agentPersona}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PATTERN_STYLES[agent.workPattern]}`}>
            {agent.workPattern}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-400">burst <span className="text-violet-300 font-mono">{agent.burstScore.toFixed(1)}</span></div>
          <div className="text-xs text-gray-400">peak <span className="text-white">{formatHour(agent.peakHour)}</span></div>
        </div>
      </div>
      <HourBar buckets={agent.hourlyBuckets} />
      <div className="text-xs text-gray-500">{agent.totalActivity} total activity · {formatHour(agent.peakHour)} peak</div>
    </div>
  );
}

export default function AgentWorkloadDistributionModal({ result, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-violet-800/50">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Workload Distribution Heatmap</h2>
            {result && (
              <p className="text-sm text-gray-400 mt-0.5">
                {result.summary.totalAgents} agent{result.summary.totalAgents !== 1 ? 's' : ''} analyzed
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Analyzing workload distribution...</span>
            </div>
          )}

          {!loading && result && result.agents.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent workload data available for this project
            </div>
          )}

          {!loading && result && result.agents.length > 0 && (
            <>
              <StatsBar result={result} />

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Agents by Activity</h3>
                <div className="space-y-2">
                  {result.agents.map((agent) => (
                    <AgentRow key={agent.agentPersona} agent={agent} />
                  ))}
                </div>
              </div>

              {result.aiSummary && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-2">AI Analysis</h3>
                  <p className="text-sm text-gray-300">{result.aiSummary}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
