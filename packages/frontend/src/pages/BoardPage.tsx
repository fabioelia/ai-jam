import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard, useProjectSessions } from '../api/queries.js';
import type { PlanningSession, ExecutionSession, ScanSession } from '../api/queries.js';
import { useCreateFeature, useCreateTicket } from '../api/mutations.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useBoardSync } from '../hooks/useBoardSync.js';
import { useAgentSync } from '../hooks/useAgentSync.js';
import { useNotificationSync } from '../hooks/useNotificationSync.js';
import { useSessionLastSeen } from '../hooks/useSessionLastSeen.js';
import { BoardSkeleton } from '../components/common/Skeleton.js';
import NotificationBell from '../components/notifications/NotificationBell.js';
import KanbanBoard from '../components/board/KanbanBoard.js';
import TicketDetail from '../components/board/TicketDetail.js';
import AgentActivityFeed from '../components/agents/AgentActivityFeed.js';
import FiltersPopover from '../components/board/FiltersPopover.js';
import type { Ticket } from '@ai-jam/shared';

// ---- Modal Component ----
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (modal) {
      modal.focus();
    }
    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: board, isLoading: boardLoading } = useBoard(projectId!, selectedFeatureId);

  // Real-time sync
  useBoardSync(projectId!);
  useAgentSync(projectId!);
  useNotificationSync();

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

  // Keyboard shortcuts: Escape to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showNewFeature) setShowNewFeature(false);
        if (showNewTicket) setShowNewTicket(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewFeature, showNewTicket]);

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
            <NotificationBell projectId={projectId!} />
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
        {/* Feature Context */}
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

        {/* Filters Button */}
        <div className="relative">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`text-sm px-2.5 py-1.5 rounded-lg border transition-colors ${
              filtersOpen
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            Filters
            {(epicFilter || priorityFilter || personaFilter || searchQuery) && (
              <span className="ml-1.5 bg-red-500/20 text-red-400 text-xs px-1.5 py-0.5 rounded-full">
                {[epicFilter, priorityFilter, personaFilter, searchQuery].filter(Boolean).length}
              </span>
            )}
          </button>

          <FiltersPopover
            isOpen={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            epics={board?.epics || []}
            personas={assignedPersonas}
            epicFilter={epicFilter}
            priorityFilter={priorityFilter}
            personaFilter={personaFilter}
            searchQuery={searchQuery}
            onEpicFilterChange={setEpicFilter}
            onPriorityFilterChange={setPriorityFilter}
            onPersonaFilterChange={setPersonaFilter}
            onSearchChange={setSearchQuery}
            onClearAll={() => {
              setEpicFilter(undefined);
              setPriorityFilter(undefined);
              setPersonaFilter(undefined);
              setSearchQuery('');
            }}
          />
        </div>

        {/* View Toggle */}
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

        {/* Primary Actions */}
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
        <Modal onClose={() => setShowNewFeature(false)}>
          <form onSubmit={handleCreateFeature} className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-lg">New Feature</h2>
              <p className="text-gray-500 text-sm mt-1">Create a new feature to start planning and tracking work.</p>
            </div>
            <div>
              <label htmlFor="feature-title" className="block text-sm font-medium text-gray-400 mb-1.5">Feature Title</label>
              <input
                id="feature-title"
                type="text"
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
                placeholder="e.g., User authentication system"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                autoFocus
                required
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowNewFeature(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!featureTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create Feature
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showNewTicket && (
        <Modal onClose={() => setShowNewTicket(false)}>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <h2 className="text-white font-semibold text-lg">New Ticket</h2>
              <p className="text-gray-500 text-sm mt-1">Add a task to the current feature board.</p>
            </div>
            <div>
              <label htmlFor="ticket-title" className="block text-sm font-medium text-gray-400 mb-1.5">Ticket Title</label>
              <input
                id="ticket-title"
                type="text"
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                placeholder="e.g., Implement login form"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="ticket-desc" className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
              <textarea
                id="ticket-desc"
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                placeholder="Describe the work to be done..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all h-28 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowNewTicket(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ticketTitle.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create Ticket
              </button>
            </div>
          </form>
        </Modal>
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
            onTicketSelect={(ticketId) => {
              const ticket = board?.columns.flatMap((c) => c.tickets).find((t) => t.id === ticketId);
              if (ticket) setSelectedTicket(ticket);
            }}
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
              <div className="text-center max-w-md px-6">
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">No feature selected</h3>
                <p className="text-gray-500 mb-6">Select a feature from the dropdown above or create a new one to get started.</p>
                <button
                  onClick={() => setShowNewFeature(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Feature
                </button>
              </div>
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
  onTicketSelect,
  width,
  onWidthChange,
}: {
  sessions: ReturnType<typeof useProjectSessions>['data'];
  projectId: string;
  selectedFeatureId?: string;
  onSelectFeature: (id: string | undefined) => void;
  onTicketSelect: (ticketId: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const navigate = useNavigate();
  const isDragging = useRef(false);
  const { isUnread, markSeen } = useSessionLastSeen();
  const [expandedSection, setExpandedSection] = useState<'planning' | 'execution' | 'scans' | 'all'>('all');
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

  const toggleSection = useCallback((section: 'planning' | 'execution' | 'scans') => {
    setExpandedSection((prev) => prev === section ? 'all' : section);
  }, []);

  const shouldShowSection = useCallback((section: 'planning' | 'execution' | 'scans') => {
    return expandedSection === 'all' || expandedSection === section;
  }, [expandedSection]);

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
                onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); onTicketSelect(s.ticketId); }}
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
                onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); onTicketSelect(s.ticketId); }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[s.status] || statusDot.completed}`} />
                  <span className={`text-xs ${personaColors[s.personaType] || 'text-gray-500'}`}>
                    {s.personaType.replace(/_/g, ' ')}
                  </span>
                  {s.status === 'failed' && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-1 rounded">failed</span>
                  )}
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
                {(s.status === 'completed' || s.status === 'failed') && (
                  <p className={`text-[10px] ml-3.5 italic ${s.status === 'failed' ? 'text-red-400/70' : 'text-gray-600'}`} title={s.outputSummary || undefined}>
                    {s.outputSummary
                      ? `${s.outputSummary.slice(0, 80)}${s.outputSummary.length > 80 ? '\u2026' : ''}`
                      : s.status === 'failed' ? 'No error details captured' : null}
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
                {s.status === 'completed' && s.outputSummary && (
                  <p className="text-[10px] text-gray-600 italic truncate ml-3.5" title={s.outputSummary}>
                    {s.outputSummary.slice(0, 60)}{s.outputSummary.length > 60 ? '\u2026' : ''}
                  </p>
                )}
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
