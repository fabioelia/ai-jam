import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard, useAgentSessions } from '../api/queries.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useNotificationSync } from '../hooks/useNotificationSync.js';
import { Skeleton } from '../components/common/Skeleton.js';
import NotificationBell from '../components/notifications/NotificationBell.js';
import ReleaseNotesModal from '../components/board/ReleaseNotesModal.js';

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
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useNotificationSync();

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

  const featureStatusInfo = FEATURE_STATUS_LABELS[feature?.status || 'draft'] || { label: 'Draft', style: 'bg-gray-600/20 text-gray-400' };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/projects/${projectId}/board`)} className="text-gray-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors hover:bg-gray-800 px-2.5 py-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Board
            </button>
            <span className="text-gray-700">/</span>
            <h1 className="text-lg font-bold text-white">{project?.name || 'Loading...'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell projectId={projectId!} />
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-sm transition-colors">Logout</button>
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
              className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 flex items-center gap-2 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Plan with Claude
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/board`)}
              className="bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm border border-gray-700 transition-colors flex items-center gap-2 hover:shadow-md hover:shadow-gray-900/10 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              View Board
            </button>
            <button
              onClick={() => setShowReleaseNotes(true)}
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 flex items-center gap-2 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Release Notes
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
                  {totalTickets > 0 ? (
                    <div className="flex h-full animate-in slide-in-from-left duration-500">
                      {columnStats.filter((c) => c.count > 0).map((col) => (
                        <div
                          key={col.status}
                          className={`${col.color} transition-all hover:opacity-80 cursor-pointer`}
                          style={{ width: `${(col.count / totalTickets) * 100}%` }}
                          title={`${col.label}: ${col.count}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-xs text-gray-600">No tickets yet</span>
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Epics</h3>
            {board && board.epics.length > 0 ? (
              <div className="space-y-3">
                {board.epics.map((epic) => {
                  const epicTickets = board.columns.flatMap((c) => c.tickets.filter((t) => t.epicId === epic.id));
                  const epicDone = epicTickets.filter((t) => t.status === 'done').length;

                  return (
                    <div key={epic.id} className="flex items-center gap-3 animate-in slide-in-from-left duration-300">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: epic.color || '#6b7280' }} />
                      <span className="text-sm text-white flex-1">{epic.title}</span>
                      <span className="text-xs text-gray-500">{epicDone}/{epicTickets.length} done</span>
                      <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: epicTickets.length > 0 ? `${(epicDone / epicTickets.length) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No epics created yet</p>
                <p className="text-gray-600 text-xs mt-1">Create epics to group related tickets together</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showReleaseNotes && projectId && featureId && (
        <ReleaseNotesModal
          projectId={projectId}
          featureId={featureId}
          onClose={() => setShowReleaseNotes(false)}
        />
      )}
    </div>
  );
}
