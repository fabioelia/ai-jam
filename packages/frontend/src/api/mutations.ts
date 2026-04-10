import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import type { Project, Feature, Ticket, Comment, ChatSession, ChatMessage } from '@ai-jam/shared';
import type { CreateProjectRequest, CreateFeatureRequest, CreateTicketRequest, MoveTicketRequest, CreateCommentRequest, CreateEpicRequest } from '@ai-jam/shared';

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectRequest) =>
      apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useCreateFeature(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFeatureRequest) =>
      apiFetch<Feature>(`/projects/${projectId}/features`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['features', projectId] }),
  });
}

export function useCreateTicket(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTicketRequest & { featureId: string }) =>
      apiFetch<Ticket>(`/projects/${projectId}/tickets`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', projectId] }),
  });
}

export function useMoveTicket(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, ...data }: MoveTicketRequest & { ticketId: string }) =>
      apiFetch<Ticket>(`/tickets/${ticketId}/move`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', projectId] }),
  });
}

export function useCreateComment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommentRequest) =>
      apiFetch<Comment>(`/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', ticketId] }),
  });
}

export function useCreateEpic(featureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEpicRequest) =>
      apiFetch(`/features/${featureId}/epics`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }),
  });
}

export function useCreateChatSession(featureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ChatSession>(`/features/${featureId}/chat-sessions`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-sessions', featureId] }),
  });
}

export function useSendChatMessage(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<ChatMessage>(`/chat-sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-session', sessionId] }),
  });
}

export function useApproveProposal(featureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      apiFetch(`/proposals/${proposalId}/approve`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals', featureId] });
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export function useRejectProposal(featureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      apiFetch(`/proposals/${proposalId}/reject`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals', featureId] }),
  });
}
