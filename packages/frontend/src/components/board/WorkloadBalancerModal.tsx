import type { WorkloadAnalysis, AssigneeLoad, WorkloadRecommendation } from '../../api/mutations.js';

const balanceColors = {
  'well-balanced': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  'moderate-imbalance': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'severe-imbalance': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const balanceLabels = {
  'well-balanced': 'Well Balanced',
  'moderate-imbalance': 'Moderate Imbalance',
  'severe-imbalance': 'Severe Imbalance',
};

const statusColors = {
  overloaded: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  balanced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  underloaded: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

function AssigneeCard({ load }: { load: AssigneeLoad }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white truncate">{load.assignee}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ml-2 ${statusColors[load.status]}`}>
          {load.status}
        </span>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
        <div>{load.ticketCount} ticket{load.ticketCount !== 1 ? 's' : ''}</div>
        <div>{load.totalStoryPoints} story points</div>
        <div className="text-xs font-mono">score: {load.loadScore.toFixed(1)}</div>
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: WorkloadRecommendation }) {
  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="font-medium text-gray-900 dark:text-white">{rec.fromAssignee}</span>
        <span className="text-gray-400">→</span>
        <span className="font-medium text-gray-900 dark:text-white">{rec.toAssignee}</span>
        <span className="text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">"{rec.ticketTitle}"</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{rec.reason}</p>
    </div>
  );
}

export default function WorkloadBalancerModal({
  result,
  isOpen,
  onClose,
}: {
  result: WorkloadAnalysis;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Workload Balancer</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${balanceColors[result.overallBalance]}`}>
            {balanceLabels[result.overallBalance]}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Assignee cards grid */}
          {result.assigneeLoads.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">No assigned tickets to analyze.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.assigneeLoads.map((load) => (
                <AssigneeCard key={load.assignee} load={load} />
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Recommendations</h3>
            {result.recommendations.length === 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">All work is well-balanced!</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {result.recommendations.map((rec) => (
                  <RecommendationRow key={rec.ticketId} rec={rec} />
                ))}
              </div>
            )}
          </div>

          {/* AI Narrative */}
          {result.narrative && (
            <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-lg p-4">
              <p className="text-sm italic text-teal-900 dark:text-teal-200">{result.narrative}</p>
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
