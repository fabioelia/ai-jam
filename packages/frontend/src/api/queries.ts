import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import type { Project, Feature, BoardState, Ticket, Comment, ChatSession, ChatMessage, TicketProposal, TicketNote, TransitionGate } from '@ai-jam/shared';

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
