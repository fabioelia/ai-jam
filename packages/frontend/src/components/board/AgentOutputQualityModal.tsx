import React from 'react';
import { AgentOutputQualityScore } from '../../api/mutations.js';

interface Props {
  scores: AgentOutputQualityScore[] | null;
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
}

const TIER_STYLES: Record<AgentOutputQualityScore['qualityTier'], string> = {
  excellent: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50',
  good: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
  fair: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
  poor: 'bg-red-900/50 text-red-300 border border-red-700/50',
};

function pct(n: number) {
  return `${n}%`;
}

export default function AgentOutputQualityModal({ scores, isOpen, loading, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Agent Output Quality Scorer</h2>
            {scores && (
              <p className="text-sm text-gray-400 mt-0.5">{scores.length} agent{scores.length !== 1 ? 's' : ''} scored</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-8 h-8 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-gray-400 text-sm">Scoring agent output quality...</span>
            </div>
          )}

          {!loading && scores && scores.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm">
              No agent output quality data available for this project
            </div>
          )}

          {!loading && scores && scores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="pb-3 pr-4 font-medium">Persona</th>
                    <th className="pb-3 pr-4 font-medium text-center">Quality Tier</th>
                    <th className="pb-3 pr-4 font-medium text-right">Completion</th>
                    <th className="pb-3 pr-4 font-medium text-right">Acceptance</th>
                    <th className="pb-3 pr-4 font-medium text-right">Rework</th>
                    <th className="pb-3 font-medium text-right">Overall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {scores.map((s) => (
                    <tr key={s.personaId} className="hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 pr-4 text-white font-medium">{s.personaId}</td>
                      <td className="py-3 pr-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_STYLES[s.qualityTier]}`}>
                          {s.qualityTier}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-300">{pct(s.ticketCompletionRate)}</td>
                      <td className="py-3 pr-4 text-right text-gray-300">{pct(s.handoffAcceptanceRate)}</td>
                      <td className="py-3 pr-4 text-right text-gray-300">{pct(s.reworkRate)}</td>
                      <td className="py-3 text-right">
                        <span className={`font-bold ${s.overallQualityScore >= 80 ? 'text-emerald-400' : s.overallQualityScore >= 60 ? 'text-blue-400' : s.overallQualityScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {s.overallQualityScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
