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
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Keyboard shortcuts: Escape to close modals, ? for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (showNewFeature) setShowNewFeature(false);
        if (showNewTicket) setShowNewTicket(false);
        if (showShortcuts) setShowShortcuts(false);
      }

      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewFeature, showNewTicket, showShortcuts]);

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
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-800"
              aria-label="Back to projects"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Projects
            </button>
            <h1 className="text-lg font-bold text-white">{project?.name || 'Loading...'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionsSidebar(!showSessionsSidebar)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                showSessionsSidebar
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
              aria-label={showSessionsSidebar ? 'Hide sessions' : 'Show sessions'}
            >
              Sessions
            </button>
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                showAgentPanel
                  ? 'bg-green-600/20 border-green-500 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
              aria-label={showAgentPanel ? 'Hide agents' : 'Show agents'}
            >
              Agents
            </button>
            <NotificationBell projectId={projectId!} />
            <button
              onClick={() => navigate(`/projects/${projectId}/settings`)}
              className="text-sm px-3 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-all duration-150"
              aria-label="Project settings"
            >
              Settings
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="text-sm px-2.5 py-1.5 rounded-lg border bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all duration-150"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <kbd className="text-xs font-mono">?</kbd>
            </button>
            <div className="w-px h-5 bg-gray-700" />
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{user?.name}</span>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-red-400 text-sm font-medium transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
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

      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <Modal onClose={() => setShowShortcuts(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Keyboard Shortcuts</h2>
              <kbd className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">?</kbd>
            </div>
            <div className="space-y-3">
              <ShortcutItem keys={['Esc']} description="Close modals or dialogs" />
              <ShortcutItem keys={['?', 'Shift']} description="Toggle this shortcuts dialog" />
              <ShortcutItem keys={['/']} description="Focus search in filters" />
            </div>
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 italic">More shortcuts coming soon</p>
            </div>
          </div>
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

// ---- Shortcut Item Component ----

function ShortcutItem({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd key={key} className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2 py-1 rounded font-mono">
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-sm text-gray-400">{description}</span>
    </div>
  );
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
            <h3 className="text-sm font-semibold text-white">Sessions</h3>
            {selectedFeatureId && (
              <button
                onClick={handleNewPlanning}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors"
              >
                + Plan
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Sections */}
        <div className="flex-1">
          {/* Planning sessions */}
          <SessionSection
            title="Planning"
            count={planning.length}
            isExpanded={shouldShowSection('planning')}
            onToggle={() => toggleSection('planning')}
          >
            {planning.length === 0 ? (
              <EmptyState message="No planning sessions" />
            ) : (
              <div className="space-y-0.5">
                {planning.map((s) => (
                  <PlanningSessionItem
                    key={s.id}
                    session={s}
                    isUnread={isUnread(s.id, s.lastActivityAt || s.createdAt)}
                    onClick={() => handlePlanningClick(s)}
                    isActive={s.status === 'active'}
                  />
                ))}
              </div>
            )}
          </SessionSection>

          {/* Execution sessions */}
          <SessionSection
            title="Execution"
            count={execution.length}
            isExpanded={shouldShowSection('execution')}
            onToggle={() => toggleSection('execution')}
          >
            {execution.length === 0 ? (
              <EmptyState message="No agent sessions" />
            ) : (
              <div className="space-y-0.5">
                {execution.map((s) => (
                  <ExecutionSessionItem
                    key={s.id}
                    session={s}
                    isUnread={isUnread(s.id, s.completedAt || s.createdAt)}
                    onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); onTicketSelect(s.ticketId); }}
                  />
                ))}
              </div>
            )}
          </SessionSection>

          {/* Scan sessions */}
          {scans.length > 0 && (
            <SessionSection
              title="Scans"
              count={scans.length}
              isExpanded={shouldShowSection('scans')}
              onToggle={() => toggleSection('scans')}
            >
              <div className="space-y-0.5">
                {scans.map((s) => (
                  <ScanSessionItem
                    key={s.id}
                    session={s}
                    isUnread={isUnread(s.id, s.completedAt || s.createdAt)}
                    onClick={() => { markSeen(s.id); forceUpdate((n) => n + 1); navigate(`/projects/${projectId}/settings`); }}
                  />
                ))}
              </div>
            </SessionSection>
          )}
        </div>
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

// ---- Session Sidebar Sub-components ----

function SessionSection({
  title,
  count,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-800/50">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800/30 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-300">
            {title}
          </span>
        </div>
        {count > 0 && (
          <span className="text-xs text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {isExpanded && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-4 text-center">
      <p className="text-xs text-gray-600 italic">{message}</p>
    </div>
  );
}

function PlanningSessionItem({
  session,
  isUnread,
  onClick,
  isActive,
}: {
  session: PlanningSession;
  isUnread: boolean;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-800/50 group transition-all duration-150"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600 group-hover:bg-gray-500'} transition-colors`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm truncate ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'} transition-colors`}>
              {session.featureTitle}
            </span>
            {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
          </div>
          {session.totalProposalCount != null && session.totalProposalCount > 0 && (
            <p className="text-xs text-gray-600 mt-0.5">
              {session.approvedProposalCount ?? 0}/{session.totalProposalCount} tickets created
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {session.lastActorRole && (
              <span className="text-[10px] text-gray-600 bg-gray-800/30 px-1.5 py-0.5 rounded">
                {session.lastActorRole === 'user' ? 'You' : 'Claude'}
              </span>
            )}
            <span className="text-[10px] text-gray-600">
              {session.lastActivityAt ? relativeTime(session.lastActivityAt) : 'active'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ExecutionSessionItem({
  session,
  isUnread,
  onClick,
}: {
  session: ExecutionSession;
  isUnread: boolean;
  onClick: () => void;
}) {
  const isActive = session.status === 'running' || session.status === 'pending';
  return (
    <div
      onClick={onClick}
      className={`px-2 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
        isActive ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-400 animate-pulse' : session.status === 'failed' ? 'bg-red-400' : 'bg-gray-600'} transition-colors`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium ${personaColors[session.personaType] || 'text-gray-500'}`}>
              {session.personaType.replace(/_/g, ' ')}
            </span>
            {session.status === 'failed' && (
              <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-medium">
                failed
              </span>
            )}
            {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
            {session.startedAt && (
              <span className="text-[10px] text-gray-600 ml-auto">{formatDuration(session.startedAt, session.completedAt)}</span>
            )}
          </div>
          {session.featureTitle && (
            <p className="text-[10px] text-gray-600 truncate mt-1">{session.featureTitle}</p>
          )}
          <p className={`text-xs truncate mt-0.5 ${session.status === 'failed' ? 'text-red-400/80' : 'text-gray-400'}`}>
            {session.ticketTitle}
          </p>
          {session.activity && session.activity !== 'idle' && (
            <p className="text-[10px] text-gray-600 truncate mt-0.5 italic">{session.activity}</p>
          )}
          {(session.status === 'completed' || session.status === 'failed') && session.outputSummary && (
            <p className={`text-[10px] mt-1 italic truncate ${session.status === 'failed' ? 'text-red-400/70' : 'text-gray-600'}`} title={session.outputSummary}>
              {session.outputSummary.slice(0, 70)}{session.outputSummary.length > 70 ? '\u2026' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScanSessionItem({
  session,
  isUnread,
  onClick,
}: {
  session: ScanSession;
  isUnread: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="px-2 py-2 rounded-lg hover:bg-gray-800/30 transition-all duration-150 cursor-pointer"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${session.status === 'running' ? 'bg-yellow-400 animate-pulse' : session.status === 'completed' ? 'bg-gray-500' : 'bg-red-400'} transition-colors`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-yellow-400">repo scanner</span>
            {isUnread && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
            <span className={`text-[10px] ml-auto ${session.status === 'completed' ? 'text-gray-600' : session.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
              {session.status}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {new Date(session.createdAt).toLocaleDateString()}
          </p>
          {session.status === 'completed' && session.outputSummary && (
            <p className="text-[10px] text-gray-600 italic truncate mt-0.5" title={session.outputSummary}>
              {session.outputSummary.slice(0, 50)}{session.outputSummary.length > 50 ? '\u2026' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
