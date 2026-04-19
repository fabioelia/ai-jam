import type { DeadlineRiskResult } from '../../api/mutations.js';

const riskColors = {
  ahead: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  on_track: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  at_risk: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const riskLabels = {
  ahead: 'Ahead',
  on_track: 'On Track',
  at_risk: 'At Risk',
  critical: 'Critical',
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DeadlineRiskModal({
  result,
  isOpen,
  onClose,
}: {
  result: DeadlineRiskResult;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const isEmpty = result.totalTickets === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deadline Risk Analysis</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{result.projectName}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskColors[result.riskLevel]}`}>
            {riskLabels[result.riskLevel]}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {isEmpty ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              No tickets found — add tickets to predict deadline
            </div>
          ) : (
            <>
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`rounded-lg p-3 text-center ${result.daysRemaining > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <p className={`text-lg font-bold ${result.daysRemaining > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {result.daysRemaining}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Days Remaining</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {result.velocityPerDay.toFixed(1)}/day
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Velocity</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                    {result.requiredVelocity.toFixed(1)}/day
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Required</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300 text-sm">
                    {formatDate(result.projectedCompletionDate)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Projected Done</p>
                </div>
              </div>

              {/* Will Meet Deadline Banner */}
              {result.willMeetDeadline ? (
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-4 py-3">
                  <span className="text-green-600 dark:text-green-400 font-bold text-lg">&#10003;</span>
                  <span className="text-green-800 dark:text-green-300 font-medium text-sm">On track to meet deadline</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3">
                  <span className="text-red-600 dark:text-red-400 font-bold text-lg">&#10007;</span>
                  <span className="text-red-800 dark:text-red-300 font-medium text-sm">Deadline at risk</span>
                </div>
              )}

              {/* Narrative Box */}
              {result.narrative && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                  <p className="text-sm text-amber-900 dark:text-amber-200">{result.narrative}</p>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recommendations</h3>
                  <ul className="space-y-1.5">
                    {result.recommendations.slice(0, 2).map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{result.completedTickets} of {result.totalTickets} tickets done</span>
                  <span>{result.totalTickets > 0 ? Math.round((result.completedTickets / result.totalTickets) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${result.totalTickets > 0 ? (result.completedTickets / result.totalTickets) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </>
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
