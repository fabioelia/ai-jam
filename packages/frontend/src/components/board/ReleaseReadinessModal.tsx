import type { ReleaseReadinessResult, ReadinessCheck } from '../../api/mutations.js';

const verdictColors = {
  ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  conditional: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  not_ready: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const verdictLabels = {
  ready: 'Ready to Release',
  conditional: 'Conditional',
  not_ready: 'Not Ready',
};

function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 text-sm font-bold shrink-0 ${check.passed ? 'text-emerald-500' : 'text-red-500'}`}>
        {check.passed ? '✓' : '✗'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{check.name}</span>
          {check.blocking && (
            <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
              Blocking
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{check.detail}</p>
      </div>
    </div>
  );
}

export default function ReleaseReadinessModal({
  result,
  isOpen,
  onClose,
}: {
  result: ReleaseReadinessResult;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Release Readiness Check</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${verdictColors[result.verdict]}`}>
            {verdictLabels[result.verdict]}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{result.doneTickets} of {result.totalTickets} tickets done</span>
              <span>{Math.round(result.completionPercent)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-emerald-500 h-4 rounded-full transition-all"
                style={{ width: `${Math.min(result.completionPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {result.checks.map((check) => (
              <CheckRow key={check.name} check={check} />
            ))}
          </div>

          {/* AI narrative */}
          {result.narrative && (
            <div className="bg-indigo-50 dark:bg-violet-900/30 border border-indigo-200 dark:border-violet-700 rounded-lg p-4 space-y-1.5">
              <p className="text-sm text-indigo-900 dark:text-violet-200">{result.narrative}</p>
              {result.topConcern && result.topConcern !== 'None' && (
                <p className="text-xs italic text-indigo-700 dark:text-violet-300">
                  Top concern: {result.topConcern}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
