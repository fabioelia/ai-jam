import type { ProjectHealthResult } from '../../api/mutations.js';

const riskColors = {
  healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  on_track: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  at_risk: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const riskLabels = {
  healthy: 'Healthy',
  on_track: 'On Track',
  at_risk: 'At Risk',
  critical: 'Critical',
};

const scoreColors = {
  healthy: 'border-green-500',
  on_track: 'border-blue-500',
  at_risk: 'border-yellow-500',
  critical: 'border-red-500',
};

const statusColors = {
  complete: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  not_started: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const statusLabels = {
  complete: 'Complete',
  in_progress: 'In Progress',
  not_started: 'Not Started',
};

export default function ProjectHealthModal({ result, isOpen, onClose }: { result: ProjectHealthResult; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const dim = result.dimensions;
  const isEmpty = result.totalTickets === 0 && result.totalEpics === 0;
  const displayedEpics = result.epicSummaries.slice(0, 5);
  const remainingEpics = result.epicSummaries.length - displayedEpics.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Project Health Report</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{result.projectName}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskColors[result.riskLevel]}`}>
            {riskLabels[result.riskLevel]}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {isEmpty ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              No tickets or epics found for this project
            </div>
          ) : (
            <>
              {/* Health Score */}
              <div className="flex items-center gap-4">
                <div className={`flex-shrink-0 w-20 h-20 rounded-full border-4 ${scoreColors[result.riskLevel]} flex items-center justify-center`}>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{result.healthScore}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Health Score</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{riskLabels[result.riskLevel]}</p>
                  <p className="text-xs text-gray-400">{result.totalTickets} tickets · {result.totalEpics} epics</p>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 space-y-2">
                <p className="text-sm text-indigo-900 dark:text-indigo-200">{result.executiveSummary}</p>
                {result.recommendedAction && (
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="font-bold">Recommended: </span>{result.recommendedAction}
                  </p>
                )}
              </div>

              {/* Dimension Bars (2x2 grid) */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Completion', value: dim.completion, color: 'bg-green-500' },
                  { label: 'Velocity', value: dim.velocity, color: 'bg-blue-500' },
                  { label: 'Quality', value: dim.quality, color: 'bg-emerald-500' },
                  { label: 'Risk', value: dim.risk, color: 'bg-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{Math.round(value)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className={`${color} h-2 rounded-full`} style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Ticket Breakdown */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { key: 'idea' as const, label: 'Idea', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
                  { key: 'backlog' as const, label: 'Backlog', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
                  { key: 'inProgress' as const, label: 'In Progress', color: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
                  { key: 'review' as const, label: 'Review', color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
                  { key: 'done' as const, label: 'Done', color: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
                ].map(({ key, label, color }) => (
                  <div key={key} className={`rounded-lg p-2 ${color}`}>
                    <p className="text-lg font-bold">{result.ticketBreakdown[key]}</p>
                    <p className="text-xs capitalize">{label}</p>
                  </div>
                ))}
              </div>

              {/* Epics Section */}
              {result.epicSummaries.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Epics</h3>
                  {displayedEpics.map((epic) => (
                    <div key={epic.epicId} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{epic.epicTitle}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-gray-500">{epic.completionRate}%</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[epic.status]}`}>
                              {statusLabels[epic.status]}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: `${epic.completionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {remainingEpics > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">...and {remainingEpics} more...</p>
                  )}
                </div>
              )}

              {/* Top Blockers */}
              {result.topBlockers.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">Top Blockers</h3>
                  <ul className="space-y-1">
                    {result.topBlockers.map((blocker, idx) => (
                      <li key={idx} className="text-sm text-orange-700 dark:text-orange-400 flex items-start gap-1.5">
                        <span className="mt-0.5">⚠</span>
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
