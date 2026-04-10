import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard } from '../api/queries.js';
import { useCreateFeature, useCreateTicket } from '../api/mutations.js';
import { useAuthStore } from '../stores/auth-store.js';
import { useBoardSync } from '../hooks/useBoardSync.js';
import { useAgentSync } from '../hooks/useAgentSync.js';
import { BoardSkeleton } from '../components/common/Skeleton.js';
import KanbanBoard from '../components/board/KanbanBoard.js';
import TicketDetail from '../components/board/TicketDetail.js';
import AgentActivityFeed from '../components/agents/AgentActivityFeed.js';
import type { Ticket } from '@ai-jam/shared';

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
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                showAgentPanel
                  ? 'bg-green-600/20 border-green-500 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
              }`}
            >
              Agents
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

      {/* Board + Agent Panel */}
      <div className="flex-1 flex overflow-hidden">
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
