import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useFeatures, useBoard, useChatSessions, useProposals } from '../api/queries.js';
import { useCreateChatSession, useResumeChatSession } from '../api/mutations.js';
import { useAuthStore } from '../stores/auth-store.js';
import { joinFeature, leaveFeature, getSocket } from '../api/socket.js';
import TerminalPanel from '../components/planning/TerminalPanel.js';
import TicketProposal from '../components/planning/TicketProposal.js';
import KanbanBoard from '../components/board/KanbanBoard.js';
import type { TicketProposal as TicketProposalType } from '@ai-jam/shared';

export default function FeaturePlanningPage() {
  const { projectId, featureId } = useParams<{ projectId: string; featureId: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId!);
  const { data: features } = useFeatures(projectId!);
  const { data: board } = useBoard(projectId!, featureId);
  const { data: chatSessionsList } = useChatSessions(featureId!);
  const { data: proposals, refetch: refetchProposals } = useProposals(featureId!);
  const createSession = useCreateChatSession(featureId!);
  const resumeSession = useResumeChatSession(featureId!);
  const user = useAuthStore((s) => s.user);

  const feature = features?.find((f) => f.id === featureId);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localProposals, setLocalProposals] = useState<TicketProposalType[]>([]);

  const activeSession = chatSessionsList?.find((s) => s.id === activeSessionId);
  const activeSessionStatus = activeSession?.status;

  // Sync proposals
  useEffect(() => {
    if (proposals) setLocalProposals(proposals);
  }, [proposals]);

  // Join feature room for real-time updates + listen for proposal events
  useEffect(() => {
    joinFeature(featureId!);
    const socket = getSocket();

    const onProposalCreated = () => refetchProposals();
    const onProposalApproved = () => refetchProposals();
    const onProposalRejected = () => refetchProposals();

    socket.on('proposal:created', onProposalCreated);
    socket.on('proposal:approved', onProposalApproved);
    socket.on('proposal:rejected', onProposalRejected);

    return () => {
      leaveFeature(featureId!);
      socket.off('proposal:created', onProposalCreated);
      socket.off('proposal:approved', onProposalApproved);
      socket.off('proposal:rejected', onProposalRejected);
    };
  }, [featureId, refetchProposals]);

  // Auto-select the latest active session, or fall back to most recent
  useEffect(() => {
    if (chatSessionsList && chatSessionsList.length > 0 && !activeSessionId) {
      const active = chatSessionsList.find((s) => s.status === 'active');
      if (active) {
        setActiveSessionId(active.id);
      } else {
        // Select the most recent session (list is ordered by createdAt desc)
        setActiveSessionId(chatSessionsList[0].id);
      }
    }
  }, [chatSessionsList, activeSessionId]);

  async function handleNewSession() {
    const session = await createSession.mutateAsync();
    setActiveSessionId(session.id);
  }

  async function handleResumeSession() {
    if (!activeSessionId) return;
    await resumeSession.mutateAsync(activeSessionId);
  }

  const pendingProposals = localProposals.filter((p) => p.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/projects/${projectId}/board`)}
              className="text-gray-400 hover:text-white text-sm"
            >
              &larr; Board
            </button>
            <h1 className="text-lg font-bold text-white">
              {feature?.title || 'Loading...'}
            </h1>
            <span className="text-xs bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded">
              Planning
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Session picker */}
            {chatSessionsList && chatSessionsList.length > 1 && (
              <select
                value={activeSessionId || ''}
                onChange={(e) => setActiveSessionId(e.target.value || null)}
                className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
              >
                {chatSessionsList.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Session {chatSessionsList.length - i} ({s.status})
                  </option>
                ))}
              </select>
            )}
            {activeSessionId && (
              <button
                onClick={handleNewSession}
                disabled={createSession.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
              >
                {createSession.isPending ? 'Starting...' : 'New Session'}
              </button>
            )}
            <span className="text-gray-400 text-sm">{user?.name}</span>
          </div>
        </div>
      </header>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Claude CLI Terminal */}
        <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
          {activeSessionId ? (
            <div className="flex-1 min-h-0">
              <TerminalPanel
                sessionId={activeSessionId}
                sessionStatus={activeSessionStatus}
                onNewSession={handleNewSession}
                onResumeSession={handleResumeSession}
                isResuming={resumeSession.isPending}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 mb-4">Start a planning session with Claude</p>
                <button
                  onClick={handleNewSession}
                  disabled={createSession.isPending}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {createSession.isPending ? 'Starting...' : 'New Planning Session'}
                </button>
              </div>
            </div>
          )}

          {/* Pending proposals bar */}
          {pendingProposals.length > 0 && (
            <div className="border-t border-gray-800 bg-gray-900/80 p-4 max-h-80 overflow-y-auto shrink-0">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Proposed Tickets ({pendingProposals.length})
              </h3>
              <div className="space-y-2">
                {pendingProposals.map((proposal) => (
                  <TicketProposal
                    key={proposal.id}
                    proposal={proposal}
                    featureId={featureId!}
                    onResolved={() => refetchProposals()}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live board preview */}
        <div className="w-[55%] shrink-0 overflow-hidden">
          {board ? (
            <KanbanBoard board={board} projectId={projectId!} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm">Board preview will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
