interface EpicHealthResult {
  epicId: string;
  epicTitle: string;
  totalTickets: number;
  healthScore: number;
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'healthy';
  dimensions: {
    completeness: number;
    velocity: number;
    readiness: number;
    scopeRisk: number;
  };
  ticketBreakdown: {
    idea: number;
    backlog: number;
    inProgress: number;
    review: number;
    done: number;
  };
  narrative: string;
  topRisk: string;
  analyzedAt: string;
}

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

export default function EpicHealthModal({ result, isOpen, onClose }: { result: EpicHealthResult; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const dim = result.dimensions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Epic Health Report</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{result.epicTitle}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${riskColors[result.riskLevel]}`}>
            {riskLabels[result.riskLevel]}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {result.totalTickets === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-base font-medium">No tickets in this epic yet.</p>
              <p className="text-sm mt-1">Add tickets to see health metrics.</p>
            </div>
          ) : (
            <>
              {/* Health Score */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-20 h-20 rounded-full border-4 border-teal-500 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{result.healthScore}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Health Score</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{riskLabels[result.riskLevel]}</p>
                  <p className="text-xs text-gray-400">{result.totalTickets} tickets total</p>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-3">
                {[
                  { label: 'Completeness', value: dim.completeness, color: 'bg-green-500' },
                  { label: 'Velocity', value: dim.velocity, color: 'bg-blue-500' },
                  { label: 'Readiness', value: dim.readiness, color: 'bg-emerald-500' },
                  { label: 'Scope Risk', value: dim.scopeRisk, color: 'bg-red-500' },
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
                {(['idea', 'backlog', 'inProgress', 'review', 'done'] as const).map((key) => (
                  <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{result.ticketBreakdown[key]}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key === 'inProgress' ? 'In Progress' : key}</p>
                  </div>
                ))}
              </div>

              {/* Narrative */}
              <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4">
                <p className="text-sm text-indigo-900 dark:text-indigo-200">{result.narrative}</p>
                {result.topRisk && (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                    <span className="font-semibold">Top Risk:</span> {result.topRisk}
                  </p>
                )}
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
