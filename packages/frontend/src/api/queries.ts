import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import type { Project, Feature, BoardState, Ticket, Comment, ChatSession, ChatMessage, TicketProposal, TicketNote, TransitionGate, Notification } from '@ai-jam/shared';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/projects'),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => apiFetch<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  });
}

export function useFeatures(projectId: string) {
  return useQuery({
    queryKey: ['features', projectId],
    queryFn: () => apiFetch<Feature[]>(`/projects/${projectId}/features`),
    enabled: !!projectId,
  });
}

export function useBoard(projectId: string, featureId?: string) {
  return useQuery({
    queryKey: ['board', projectId, featureId],
    queryFn: () => {
      const params = featureId ? `?featureId=${featureId}` : '';
      return apiFetch<BoardState>(`/projects/${projectId}/board${params}`);
    },
    enabled: !!projectId,
  });
}

export function useTicket(ticketId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId],
    queryFn: () => apiFetch<Ticket>(`/tickets/${ticketId}`),
    enabled: !!ticketId,
  });
}

export function useComments(ticketId: string) {
  return useQuery({
    queryKey: ['comments', ticketId],
    queryFn: () => apiFetch<Comment[]>(`/tickets/${ticketId}/comments`),
    enabled: !!ticketId,
  });
}

export function useChatSessions(featureId: string) {
  return useQuery({
    queryKey: ['chat-sessions', featureId],
    queryFn: () => apiFetch<ChatSession[]>(`/features/${featureId}/chat-sessions`),
    enabled: !!featureId,
    refetchInterval: 5000,
  });
}

export function useChatSession(sessionId: string) {
  return useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: () => apiFetch<ChatSession & { messages: ChatMessage[] }>(`/chat-sessions/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function useProposals(featureId: string) {
  return useQuery({
    queryKey: ['proposals', featureId],
    queryFn: () => apiFetch<TicketProposal[]>(`/features/${featureId}/proposals`),
    enabled: !!featureId,
  });
}

export function useTicketNotes(ticketId: string) {
  return useQuery({
    queryKey: ['ticket-notes', ticketId],
    queryFn: () => apiFetch<TicketNote[]>(`/tickets/${ticketId}/notes`),
    enabled: !!ticketId,
  });
}

export function useTransitionGates(ticketId: string) {
  return useQuery({
    queryKey: ['transition-gates', ticketId],
    queryFn: () => apiFetch<TransitionGate[]>(`/tickets/${ticketId}/gates`),
    enabled: !!ticketId,
  });
}

// -- System Prompts --

export interface SystemPrompt {
  id: string;
  projectId: string | null;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  isDefault: number;
  createdAt: string;
  updatedAt: string;
}

export function useSystemPrompts() {
  return useQuery({
    queryKey: ['system-prompts'],
    queryFn: () => apiFetch<SystemPrompt[]>('/system-prompts'),
  });
}

export function useProjectSystemPrompts(projectId: string) {
  return useQuery({
    queryKey: ['system-prompts', projectId],
    queryFn: () => apiFetch<SystemPrompt[]>(`/projects/${projectId}/system-prompts`),
    enabled: !!projectId,
  });
}

// -- Scans --

export interface ProjectScan {
  id: string;
  projectId: string;
  systemPromptId: string | null;
  status: string;
  outputSummary: string | null;
  outputFiles: string[];
  agentSessionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function useProjectScans(projectId: string, hasRunningScan?: boolean) {
  return useQuery({
    queryKey: ['scans', projectId],
    queryFn: () => apiFetch<ProjectScan[]>(`/projects/${projectId}/scans`),
    enabled: !!projectId,
    refetchInterval: hasRunningScan ? 3000 : false,
  });
}

// -- Knowledge Files --

export interface KnowledgeFileInfo {
  filename: string;
  path: string;
}

export interface KnowledgeFileContent {
  filename: string;
  content: string;
}

export function useKnowledgeFiles(projectId: string) {
  return useQuery({
    queryKey: ['knowledge', projectId],
    queryFn: () => apiFetch<KnowledgeFileInfo[]>(`/projects/${projectId}/knowledge`),
    enabled: !!projectId,
  });
}

export function useKnowledgeFile(projectId: string, filename: string) {
  return useQuery({
    queryKey: ['knowledge', projectId, filename],
    queryFn: () => apiFetch<KnowledgeFileContent>(`/projects/${projectId}/knowledge/${filename}`),
    enabled: !!projectId && !!filename,
  });
}

// -- Users & Members --

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface ProjectMember {
  userId: string;
  role: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<UserInfo[]>('/users'),
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => apiFetch<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
}

export function useAgentSessions(ticketId: string) {
  return useQuery({
    queryKey: ['agent-sessions', ticketId],
    queryFn: () => apiFetch<Array<{
      id: string;
      personaType: string;
      status: string;
      activity: string;
      startedAt: string | null;
      completedAt: string | null;
      outputSummary: string | null;
    }>>(`/agent-sessions?ticketId=${ticketId}`),
    enabled: !!ticketId,
  });
}

// -- Project Sessions (combined planning + execution + scans) --

export interface PlanningSession {
  id: string;
  type: 'planning';
  featureId: string;
  featureTitle: string;
  status: string;
  createdAt: string;
  approvedProposalCount: number;
  totalProposalCount: number;
  messageCount: number;
  lastActivityAt: string;
  lastActorRole: string | null;
}

export interface ExecutionSession {
  id: string;
  type: 'execution';
  ticketId: string;
  ticketTitle: string;
  featureId: string;
  featureTitle: string;
  personaType: string;
  status: string;
  activity: string;
  outputSummary: string | null;
  startedAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ScanSession {
  id: string;
  type: 'scan';
  personaType: string;
  status: string;
  activity: string;
  outputSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ProjectSessions {
  planning: PlanningSession[];
  execution: ExecutionSession[];
  scans: ScanSession[];
}

export function useProjectSessions(projectId: string) {
  return useQuery({
    queryKey: ['project-sessions', projectId],
    queryFn: () => apiFetch<ProjectSessions>(`/projects/${projectId}/sessions`),
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

// -- Pending Approvals --

export interface PendingProposal {
  id: string;
  type: 'proposal';
  featureId: string;
  featureTitle: string;
  ticketTitle?: string;
  ticketPriority?: string;
  source: string;
  createdAt: string;
}

export interface PendingGate {
  id: string;
  type: 'gate';
  ticketId: string;
  ticketTitle: string;
  featureId: string;
  featureTitle: string;
  fromStatus: string;
  toStatus: string;
  gatekeeperPersona: string;
  createdAt: string;
}

export interface PendingApprovals {
  proposals: PendingProposal[];
  gates: PendingGate[];
  totalCount: number;
}

export function usePendingApprovals(projectId: string) {
  return useQuery({
    queryKey: ['pending-approvals', projectId],
    queryFn: () => apiFetch<PendingApprovals>(`/projects/${projectId}/pending-approvals`),
    enabled: !!projectId,
    refetchInterval: 15000,
  });
}

// -- Notifications --

export interface NotificationFilters {
  featureId?: string;
  type?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export function useNotifications(projectId: string, opts?: NotificationFilters) {
  const params = new URLSearchParams();
  if (opts?.featureId) params.set('featureId', opts.featureId);
  if (opts?.type) params.set('type', opts.type);
  if (opts?.isRead !== undefined) params.set('isRead', String(opts.isRead));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString();

  return useQuery({
    queryKey: ['notifications', projectId, opts],
    queryFn: () => apiFetch<Notification[]>(`/projects/${projectId}/notifications${qs ? `?${qs}` : ''}`),
    enabled: !!projectId,
  });
}

export function useUnreadCount(projectId: string, featureId?: string) {
  const params = featureId ? `?featureId=${featureId}` : '';
  return useQuery({
    queryKey: ['notifications-unread-count', projectId, featureId],
    queryFn: () => apiFetch<{ count: number }>(`/projects/${projectId}/notifications/unread-count${params}`),
    enabled: !!projectId,
  });
}
