import type { TriageResult } from '../../api/mutations.js';

interface TicketTriageModalProps {
  result: TriageResult;
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: TriageResult) => void;
}

function confidenceBadgeClass(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high': return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-600/20 text-gray-400 border-gray-500/40';
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    case 'low': return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/40';
  }
}

export default function TicketTriageModal({ result, isOpen, onClose, onApply }: TicketTriageModalProps) {
  if (!isOpen || !result) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            AI Ticket Triage
            <span className={`text-xs font-medium px-2 py-1 rounded-full border capitalize ${confidenceBadgeClass(result.confidence)}`}>
              {result.confidence} confidence
            </span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Suggestions grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority Card */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Priority</p>
              <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full border capitalize ${priorityBadgeClass(result.suggestedPriority)}`}>
                {result.suggestedPriority}
              </span>
            </div>

            {/* Story Points Card */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Story Points</p>
              <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                <span className="text-lg font-bold text-violet-300">{result.suggestedStoryPoints}</span>
              </div>
            </div>

            {/* Epic Card */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Epic</p>
              <p className="text-sm text-white font-medium truncate">
                {result.suggestedEpicName || <span className="text-gray-500 italic">None suggested</span>}
              </p>
            </div>

            {/* Assignee Card */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Assignee</p>
              <p className="text-sm text-white font-medium truncate">
                {result.suggestedAssignee || <span className="text-gray-500 italic">Unassigned</span>}
              </p>
            </div>
          </div>

          {/* AI Reasoning box */}
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">AI Reasoning</span>
            </div>
            <p className="text-sm text-indigo-200 leading-relaxed">{result.reasoning}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onApply(result)}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Apply Suggestions
          </button>
        </div>
      </div>
    </div>
  );
}
