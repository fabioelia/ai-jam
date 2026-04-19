import type { TicketQualityResult } from '../../api/mutations.js';

interface TicketQualityModalProps {
  result: TicketQualityResult;
  ticketTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-500';
    case 'B': return 'bg-blue-500';
    case 'C': return 'bg-yellow-500';
    case 'D': return 'bg-orange-500';
    case 'F': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function TicketQualityModal({ result, ticketTitle, onClose }: TicketQualityModalProps) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span className="text-purple-400">✦</span>
            Ticket Quality Score
            <span className="text-gray-500 text-sm font-normal">— {ticketTitle}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overall score + grade */}
          <div className="flex items-center gap-4">
            <div className={`rounded-xl px-6 py-4 text-center ${gradeColor(result.grade)}/10 border ${gradeColor(result.grade)}/40`}>
              <span className="text-5xl font-bold text-white">{result.overallScore}</span>
              <span className="text-gray-500 text-lg ml-1">/100</span>
            </div>
            <span className={`text-3xl font-bold text-white px-4 py-2 rounded-lg ${gradeColor(result.grade)} bg-opacity-80`}>
              {result.grade}
            </span>
            <span className="text-gray-400 text-sm capitalize">{result.confidence} confidence</span>
          </div>

          {/* Dimension breakdown */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Dimension Breakdown</h3>
            <div className="space-y-3">
              {Object.values(result.dimensions).map((dim) => (
                <div key={dim.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{dim.label}</span>
                    <span className="text-sm font-mono text-gray-400">{dim.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${scoreBarColor(dim.score)}`}
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{dim.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Suggestions</h3>
              <div className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3"
                  >
                    <span className="text-sm text-yellow-300">{i + 1}. {s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
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
