import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard, useAgentSessions } from '../api/queries.js';
import { useAuthStore } from '../stores/auth-store.js';
import { Skeleton } from '../components/common/Skeleton.js';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: 'bg-gray-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500' },
  review: { label: 'Review', color: 'bg-yellow-500' },
  qa: { label: 'QA', color: 'bg-orange-500' },
  acceptance: { label: 'Acceptance', color: 'bg-purple-500' },
  done: { label: 'Done', color: 'bg-green-500' },
};

const FEATURE_STATUS_LABELS: Record<string, { label: string; style: string }> = {
  draft: { label: 'Draft', style: 'bg-gray-600/20 text-gray-400' },
  planning: { label: 'Planning', style: 'bg-blue-600/20 text-blue-400' },
  planned: { label: 'Planned', style: 'bg-indigo-600/20 text-indigo-400' },
  in_progress: { label: 'In Progress', style: 'bg-green-600/20 text-green-400' },
  done: { label: 'Done', style: 'bg-emerald-600/20 text-emerald-400' },
};

export default function FeatureDetailPage() {
  const { projectId, featureId } = useParams<{ projectId: string; featureId: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId!);
  const { data: features } = useFeatures(projectId!);
  const { data: board, isLoading: boardLoading } = useBoard(projectId!, featureId);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const feature = features?.find((f) => f.id === featureId);

  // Compute ticket stats per column
  const columnStats = board
    ? board.columns.map((col) => ({
        status: col.status,
        count: col.tickets.length,
        ...STATUS_LABELS[col.status],
      }))
    : [];

  const totalTickets = columnStats.reduce((s, c) => s + c.count, 0);
  const doneCount = columnStats.find((c) => c.status === 'done')?.count || 0;
  const progressPercent = totalTickets > 0 ? Math.round((doneCount / totalTickets) * 100) : 0;

  const featureStatusInfo = FEATURE_STATUS_LABELS[feature?.status || 'draft'] || FEATURE_STATUS_LABELS.draft;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/projects/${projectId}/board`)} className="text-gray-400 hover:text-white text-sm">
              &larr; Board
            </button>
            <h1 className="text-lg font-bold text-white">{project?.name || 'Loading...'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-gray-300 text-sm">Logout</button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Feature header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-white">{feature?.title || 'Loading...'}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full ${featureStatusInfo.style}`}>
                {featureStatusInfo.label}
              </span>
            </div>
            {feature?.description && (
              <p className="text-gray-400 mt-2 whitespace-pre-wrap">{feature.description}</p>
            )}
            {feature?.repoBranch && (
              <p className="text-gray-500 text-sm mt-2">
                Branch: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{feature.repoBranch}</code>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/projects/${projectId}/features/${featureId}/plan`)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Plan with Claude
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/board`)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm border border-gray-700"
            >
              View Board
            </button>
          </div>

          {/* Progress overview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Progress</h3>
              <span className="text-gray-400 text-sm">{doneCount}/{totalTickets} tickets done</span>
            </div>

            {boardLoading ? (
              <Skeleton className="h-3 w-full rounded-full" />
            ) : (
              <>
                {/* Progress bar */}
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-6">
                  {totalTickets > 0 && (
                    <div className="flex h-full">
                      {columnStats.filter((c) => c.count > 0).map((col) => (
                        <div
                          key={col.status}
                          className={`${col.color} transition-all`}
                          style={{ width: `${(col.count / totalTickets) * 100}%` }}
                          title={`${col.label}: ${col.count}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Column breakdown */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {columnStats.map((col) => (
                    <div key={col.status} className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${col.color}`} />
                        <span className="text-xs text-gray-500">{col.label}</span>
                      </div>
                      <span className="text-lg font-semibold text-white">{col.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Epics */}
          {board && board.epics.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Epics</h3>
              <div className="space-y-3">
                {board.epics.map((epic) => {
                  const epicTickets = board.columns.flatMap((c) => c.tickets.filter((t) => t.epicId === epic.id));
                  const epicDone = epicTickets.filter((t) => t.status === 'done').length;

                  return (
                    <div key={epic.id} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: epic.color || '#6b7280' }} />
                      <span className="text-sm text-white flex-1">{epic.title}</span>
                      <span className="text-xs text-gray-500">{epicDone}/{epicTickets.length} done</span>
                      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: epicTickets.length > 0 ? `${(epicDone / epicTickets.length) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
