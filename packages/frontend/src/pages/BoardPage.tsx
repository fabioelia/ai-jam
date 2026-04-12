import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard, useProjectSessions } from '../api/queries.js';
import type { PlanningSession, ExecutionSession, ScanSession } from '../api/queries.js';
import { useCreateFeature, useCreateTicket } from '../api/mutations.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useBoardSync } from '../hooks/useBoardSync.js';
import { useAgentSync } from '../hooks/useAgentSync.js';
import { useSessionLastSeen } from '../hooks/useSessionLastSeen.js';
import { BoardSkeleton } from '../components/common/Skeleton.js';
import KanbanBoard from '../components/board/KanbanBoard.js';
import TicketDetail from '../components/board/TicketDetail.js';
import AgentActivityFeed from '../components/agents/AgentActivityFeed.js';
import type { Ticket } from '@ai-jam/shared';

const SIDEBAR_STORAGE_KEY = 'ai-jam:sidebar-width';

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId!);
  const { data: features } = useFeatures(projectId!);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [selectedFeatureId, setSelectedFeatureId] = useState<string | undefined>();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [epicFilter, setEpicFilter] = useState<string | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [personaFilter, setPersonaFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByEpic, setGroupByEpic] = useState(false);
  const { data: board, isLoading: boardLoading } = useBoard(projectId!, selectedFeatureId);

  // Real-time sync
  useBoardSync(projectId!);
  useAgentSync(projectId!);

  const [showAgentPanel, setShowAgentPanel] = useState(false);

  const createFeature = useCreateFeature(projectId!);
  const createTicket = useCreateTicket(projectId!);

  const { data: sessions } = useProjectSessions(projectId!);
  const [showSessionsSidebar, setShowSessionsSidebar] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored ? Math.min(480, Math.max(200, Number(stored))) : 256;
  });

  const persistSidebarWidth = useCallback((width: number) => {
    setSidebarWidth(width);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(width));
  }, []);

  const [showNewFeature, setShowNewFeature] = useState(false);
  const [featureTitle, setFeatureTitle] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');

  async function handleCreateFeature(e: React.FormEvent) {
    e.preventDefault();
    const feature = await createFeature.mutateAsync({ title: featureTitle });
    setSelectedFeatureId(feature.id);
    setShowNewFeature(false);
    setFeatureTitle('');
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFeatureId) return;
    await createTicket.mutateAsync({
      title: ticketTitle,
      description: ticketDesc || undefined,
      featureId: selectedFeatureId,
    });
    setShowNewTicket(false);
    setTicketTitle('');
    setTicketDesc('');
  }

  // Unique assigned personas for filter dropdown
  const assignedPersonas = useMemo(() => {
    if (!board) return [];
    const personas = new Set<string>();
    for (const col of board.columns) {
      for (const t of col.tickets) {
        if (t.assignedPersona) personas.add(t.assignedPersona);
      }
    }
    return [...personas].sort();
  }, [board]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">
              &larr; Projects
            </button>
            <h1 className="text-lg font-bold text-white">{project?.name || 'Loading...'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSessionsSidebar(!showSessionsSidebar)}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                showSessionsSidebar
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                showAgentPanel
                  ? 'bg-green-600/20 border-green-500 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/settings`)}
              className="text-sm px-2.5 py-1 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 transition-colors"
            >
              Settings
            </button>
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-gray-300 text-sm">Logout</button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-2 flex items-center gap-3 shrink-0">
        {/* Feature selector */}
        <select
          value={selectedFeatureId || ''}
          onChange={(e) => setSelectedFeatureId(e.target.value || undefined)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Features</option>
          {features?.map((f) => (
            <option key={f.id} value={f.id}>{f.title}</option>
          ))}
        </select>

        <button
          onClick={() => setShowNewFeature(true)}
          className="text-indigo-400 hover:text-indigo-300 text-sm"
        >
          + Feature
        </button>

        {selectedFeatureId && (
          <button
            onClick={() => navigate(`/projects/${projectId}/features/${selectedFeatureId}/plan`)}
            className="bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30 px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            Plan with Claude
          </button>
        )}

        <div className="w-px h-5 bg-gray-700" />

        {/* Epic filter */}
        {board && board.epics.length > 0 && (
          <select
            value={epicFilter || ''}
            onChange={(e) => setEpicFilter(e.target.value || undefined)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Epics</option>
            {board.epics.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        )}

        {/* Priority filter */}
        <select
          value={priorityFilter || ''}
          onChange={(e) => setPriorityFilter(e.target.value || undefined)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Persona / assignee filter */}
        {assignedPersonas.length > 0 && (
          <select
            value={personaFilter || ''}
            onChange={(e) => setPersonaFilter(e.target.value || undefined)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Assignees</option>
            {assignedPersonas.map((p) => (
              <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-indigo-500 w-48"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {/* Group by epic toggle */}
        {board && board.epics.length > 0 && (
          <button
            onClick={() => setGroupByEpic(!groupByEpic)}
            className={`text-sm px-2.5 py-1.5 rounded-lg border transition-colors ${
              groupByEpic
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            Group by Epic
          </button>
        )}

        <div className="flex-1" />

        {selectedFeatureId && (
          <button
            onClick={() => setShowNewTicket(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            + Ticket
          </button>
        )}
      </div>

      {/* Modals */}
      {showNewFeature && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <form onSubmit={handleCreateFeature} className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-white font-semibold">New Feature</h2>
            <input
              type="text"
              value={featureTitle}
              onChange={(e) => setFeatureTitle(e.target.value)}
              placeholder="Feature title"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              autoFocus
              required
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNewFeature(false)} className="text-gray-400 px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button>
            </div>
          </form>
        </div>
      )}

      {showNewTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <form onSubmit={handleCreateTicket} className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-white font-semibold">New Ticket</h2>
            <input
              type="text"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              placeholder="Ticket title"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              autoFocus
              required
            />
            <textarea
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNewTicket(false)} className="text-gray-400 px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions Sidebar + Board + Agent Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sessions Sidebar */}
        {showSessionsSidebar && (
          <SessionsSidebar
            sessions={sessions}
            projectId={projectId!}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            width={sidebarWidth}
            onWidthChange={persistSidebarWidth}
          />
        )}

        <div className="flex-1 overflow-hidden">
          {boardLoading ? (
            <BoardSkeleton />
          ) : board ? (
            <KanbanBoard
              board={board}
              projectId={projectId!}
              epicFilter={epicFilter}
              priorityFilter={priorityFilter}
              personaFilter={personaFilter}
              searchQuery={searchQuery}
              groupByEpic={groupByEpic}
              onTicketClick={setSelectedTicket}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select or create a feature to see the board.</p>
            </div>
          )}
        </div>

        {/* Agent Activity Panel */}
        {showAgentPanel && (
          <div className="w-80 shrink-0 border-l border-gray-800 bg-gray-900 overflow-y-auto">
            <AgentActivityFeed />
          </div>
        )}
      </div>

      {/* Ticket Detail Slide-over */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          epics={board?.epics || []}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}

// ---- Utility helpers ----

function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function formatDuration(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ---- Sessions Sidebar ----

const statusDot: Record<string, string> = {
  active: 'bg-green-400',
  running: 'bg-green-400',
  pending: 'bg-yellow-400',
  completed: 'bg-gray-500',
  failed: 'bg-red-400',
};

const personaColors: Record<string, string> = {
  planner: 'text-indigo-400',
  implementer: 'text-green-400',
  reviewer: 'text-amber-400',
  qa_tester: 'text-orange-400',
  acceptance_validator: 'text-purple-400',
  orchestrator: 'text-violet-400',
  repo_scanner: 'text-yellow-400',
};

function SessionsSidebar({
  sessions,
  projectId,
  selectedFeatureId,
  onSelectFeature,
  width,
  onWidthChange,
}: {
  sessions: ReturnType<typeof useProjectSessions>['data'];
  projectId: string;
  selectedFeatureId?: string;
  onSelectFeature: (id: string | undefined) => void;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const navigate = useNavigate();
  const isDragging = useRef(false);
  const { isUnread, markSeen } = useSessionLastSeen();
  const [, forceUpdate] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(480, Math.max(200, startWidth + delta));
      onWidthChange(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, onWidthChange]);

  const planning = sessions?.planning || [];
  const execution = sessions?.execution || [];
  const scans = sessions?.scans || [];

  const activePlanning = planning.filter((s) => s.status === 'active');
  const pastPlanning = planning.filter((s) => s.status !== 'active');
  const activeExecution = execution.filter((s) => s.status === 'running' || s.status === 'pending');
  const pastExecution = execution.filter((s) => s.status !== 'running' && s.status !== 'pending');

  function handlePlanningClick(s: PlanningSession) {
    markSeen(s.id);
    forceUpdate((n) => n + 1);
    navigate(`/projects/${projectId}/features/${s.featureId}/plan`);
  }

  function handleNewPlanning() {
    if (selectedFeatureId) {
      navigate(`/projects/${projectId}/features/${selectedFeatureId}/plan`);
    }
  }

  return (
    <div className="shrink-0 border-r border-gray-800 bg-gray-900 flex relative" style={{ width }}>
      <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Sessions</h3>
          {selectedFeatureId && (
            <button
              onClick={handleNewPlanning}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded"
            >
              + Plan
            </button>
          )}
        </div>
      </div>

      {/* Planning sessions */}
      <div className="px-3 py-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Planning</h4>
        {activePlanning.length === 0 && pastPlanning.length === 0 ? (
          <p className="text-xs text-gray-600 italic px-1">No planning sessions</p>
        ) : (
          <div className="space-y-1">
            {activePlanning.map((s) => (
              <button
                key={s.id}
                onClick={() => handlePlanningClick(s)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-800 group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[s.status] || statusDot.completed}`} />
                  <span className="text-sm text-gray-200 truncate group-hover:text-white">
                    {s.featureTitle}
                  </span>
                  {isUnread(s.id, s.lastActivityAt || s.createdAt) && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                </div>
                <div className="ml-3.5 space-y-0.5">
                  {s.totalProposalCount != null && s.totalProposalCount > 0 && (
                    <p className="text-xs text-gray-500">
                      {s.approvedProposalCount ?? 0}/{s.totalProposalCount} tickets created
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    {s.lastActorRole && (
                      <span>Last: {s.lastActorRole === 'user' ? 'you' : 'Claude'}</span>
                    )}
                    {s.lastActivityAt ? (
                      <span>{relativeTime(s.lastActivityAt)}</span>
                    ) : (
                      <span>active</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {pastPlanning.slice(0, 10).map((s) => (
              <button
                key={s.id}
                onClick={() => handlePlanningClick(s)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-800 group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[s.status] || statusDot.completed}`} />
                  <span className="text-sm text-gray-400 truncate group-hover:text-gray-300">
                    {s.featureTitle}
                  </span>
                  {isUnread(s.id, s.lastActivityAt || s.createdAt) && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                </div>
                <div className="ml-3.5 space-y-0.5">
                  {s.totalProposalCount != null && s.totalProposalCount > 0 && (
                    <p className="text-xs text-gray-600">
                      {s.approvedProposalCount ?? 0}/{s.totalProposalCount} tickets created
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    {s.lastActorRole && (
                      <span>Last: {s.lastActorRole === 'user' ? 'you' : 'Claude'}</span>
                    )}
                    <span>{s.lastActivityAt ? relativeTime(s.lastActivityAt) : new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Execution sessions */}
      <div className="px-3 py-3 border-t border-gray-800">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Execution</h4>
        {activeExecution.length === 0 && pastExecution.length === 0 ? (
          <p className="text-xs text-gray-600 italic px-1">No agent sessions</p>
        ) : (
          <div className="space-y-1">
            {activeExecution.map((s) => (
              <div
                key={s.id}
                className="px-2 py-1.5 rounded-lg bg-gray-800/50 cursor-pointer"
                onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${statusDot[s.status] || statusDot.completed}`} />
                  <span className={`text-xs font-medium ${personaColors[s.personaType] || 'text-gray-400'}`}>
                    {s.personaType.replace(/_/g, ' ')}
                  </span>
                  {isUnread(s.id, s.completedAt || s.createdAt) && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                  {s.startedAt && (
                    <span className="text-xs text-gray-600 ml-auto">{formatDuration(s.startedAt, s.completedAt)}</span>
                  )}
                </div>
                {s.featureTitle && (
                  <p className="text-[10px] text-gray-600 truncate ml-3.5">{s.featureTitle}</p>
                )}
                <p className="text-xs text-gray-400 truncate ml-3.5">{s.ticketTitle}</p>
                <span className="text-xs text-gray-600 ml-3.5">{s.activity}</span>
              </div>
            ))}
            {pastExecution.slice(0, 15).map((s) => (
              <div
                key={s.id}
                className="px-2 py-1.5 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
                onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[s.status] || statusDot.completed}`} />
                  <span className={`text-xs ${personaColors[s.personaType] || 'text-gray-500'}`}>
                    {s.personaType.replace(/_/g, ' ')}
                  </span>
                  {isUnread(s.id, s.completedAt || s.createdAt) && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                  {s.startedAt && (
                    <span className="text-xs text-gray-600 ml-auto">{formatDuration(s.startedAt, s.completedAt)}</span>
                  )}
                </div>
                {s.featureTitle && (
                  <p className="text-[10px] text-gray-600 truncate ml-3.5">{s.featureTitle}</p>
                )}
                <p className="text-xs text-gray-500 truncate ml-3.5">{s.ticketTitle}</p>
                {s.outputSummary && s.status === 'completed' && (
                  <p className="text-[10px] text-gray-600 truncate ml-3.5 italic">
                    {s.outputSummary.slice(0, 60)}{s.outputSummary.length > 60 ? '\u2026' : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan sessions */}
      {scans.length > 0 && (
        <div className="px-3 py-3 border-t border-gray-800">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Scans</h4>
          <div className="space-y-1">
            {scans.map((s) => (
              <div
                key={s.id}
                className="px-2 py-1.5 rounded-lg hover:bg-gray-800/30 transition-colors cursor-pointer"
                onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); navigate(`/projects/${projectId}/settings`); }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'running' ? 'animate-pulse ' : ''}${statusDot[s.status] || statusDot.completed}`} />
                  <span className="text-xs text-yellow-400">repo scanner</span>
                  {isUnread(s.id, s.completedAt || s.createdAt) && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                  <span className={`text-xs ml-auto ${s.status === 'completed' ? 'text-gray-600' : s.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
                    {s.status}
                  </span>
                </div>
                <span className="text-xs text-gray-600 ml-3.5">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group z-10 flex items-center justify-center"
      >
        <div className="w-px h-full bg-transparent group-hover:bg-indigo-500/50 transition-colors" />
        <div className="absolute w-3 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5">
          <span className="block w-0.5 h-0.5 rounded-full bg-gray-400" />
          <span className="block w-0.5 h-0.5 rounded-full bg-gray-400" />
          <span className="block w-0.5 h-0.5 rounded-full bg-gray-400" />
        </div>
      </div>
    </div>
  );
}
