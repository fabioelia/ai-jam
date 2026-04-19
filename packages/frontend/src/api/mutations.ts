import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client.js';
import { useState } from 'react';
import type { Project, Feature, Ticket, Comment, ChatSession, ChatMessage, AttentionItem } from '@ai-jam/shared';
export interface SprintAnalysis {
  healthScore: number;
  risks: Array<{ ticketId: string; title: string; reason: string; severity: 'high' | 'medium' | 'low' }>;
  bottlenecks: Array<{ status: string; count: number; avgDaysSinceUpdate: number }>;
  recommendations: string[];
  analyzedAt: string;
}
import type { CreateProjectRequest, CreateFeatureRequest, CreateTicketRequest, MoveTicketRequest, CreateCommentRequest, CreateEpicRequest } from '@ai-jam/shared';

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectRequest) =>
      apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; defaultBranch?: string; githubToken?: string; supportWorktrees?: boolean; personaModelOverrides?: Record<string, string>; maxRejectionCycles?: number }) =>
      apiFetch<Project>(`/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      apiFetch(`/projects/${projectId}`, { method: 'DELETE' }),
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

export function useSuggestDependencies(projectId: string) {
  return useMutation({
    mutationFn: (data: { title: string; description?: string; excludeTicketId?: string }) =>
      apiFetch<{
        suggestions: Array<{
          ticketId: string;
          ticket: { id: string; title: string; status: string; priority: string };
          relationship: 'blocks' | 'blocked_by' | 'related';
          confidence: number;
          reason: string;
        }>;
      }>(`/projects/${projectId}/tickets/suggest-dependencies`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateClaudeTicket(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      userPrompt: string;
      featureId: string;
      attachments?: Array<{ id: string; type: 'image' | 'document'; mimeType: string; url: string }>;
      onStream?: (delta: string) => void;
    }) => {
      if (data.onStream) {
        const response = await fetch(`/api/projects/${projectId}/tickets/claude-create?stream=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create ticket');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                if (data.delta) {
                  data.onStream(data.delta);
                  fullResponse += data.delta;
                } else if (data.done) {
                  return { ticket: data.ticket, usage: data.usage };
                } else if (data.error) {
                  throw new Error(data.error);
                }
              }
            }
          }
        }
        throw new Error('Stream ended unexpectedly');
      } else {
        return apiFetch<{ ticket: Ticket; usage: { inputTokens: number; outputTokens: number }; cost: number }>(
          `/projects/${projectId}/tickets/claude-create`,
          { method: 'POST', body: JSON.stringify(data) }
        );
      }
    },
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

export function useResumeChatSession(featureId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<ChatSession>(`/chat-sessions/${sessionId}/resume`, { method: 'POST', body: JSON.stringify({}) }),
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

// -- System Prompts --

export function useUpdateSystemPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; content?: string }) =>
      apiFetch(`/system-prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-prompts'] }),
  });
}

export function useCreateProjectSystemPrompt(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { slug: string; name: string; description?: string; content: string }) =>
      apiFetch(`/projects/${projectId}/system-prompts`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-prompts', projectId] }),
  });
}

export function useDeleteSystemPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/system-prompts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-prompts'] }),
  });
}

// -- Scans --

export function useTriggerScan(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (systemPromptId?: string) =>
      apiFetch(`/projects/${projectId}/scans`, {
        method: 'POST',
        body: JSON.stringify({ systemPromptId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans', projectId] });
      qc.invalidateQueries({ queryKey: ['knowledge', projectId] });
    },
  });
}

// -- Project Members --

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; role?: string }) =>
      apiFetch(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
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

// -- Attention Items --

export function useResolveAttention(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote?: string }) =>
      apiFetch<AttentionItem>(`/attention/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNote }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attention', projectId] });
      qc.invalidateQueries({ queryKey: ['attention-count'] });
    },
  });
}

export function useDismissAttention(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AttentionItem>(`/attention/${id}/dismiss`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attention', projectId] });
      qc.invalidateQueries({ queryKey: ['attention-count'] });
    },
  });
}

// -- Notification Preferences --

export function useUpdateNotificationPreferences(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      apiFetch<{ preferences: Record<string, boolean> }>(`/projects/${projectId}/notification-preferences`, {
        method: 'PUT',
        body: JSON.stringify({ preferences }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences', projectId] }),
  });
}

// -- Notifications --

export function useMarkRead(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', projectId] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count', projectId] });
    },
  });
}

export function useMarkAllRead(projectId: string, featureId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const params = featureId ? `?featureId=${featureId}` : '';
      return apiFetch(`/projects/${projectId}/notifications/read-all${params}`, { method: 'PATCH' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', projectId] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count', projectId] });
    },
  });
}

// -- Global notification mutations (used by NotificationsPage) --

function invalidateAllNotifications(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['all-notifications'] });
  qc.invalidateQueries({ queryKey: ['global-unread-count'] });
  qc.invalidateQueries({ queryKey: ['notifications'] });
  qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
}

export function useGlobalMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId?: string) =>
      apiFetch('/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify(projectId ? { projectId } : {}),
      }),
    onSuccess: () => invalidateAllNotifications(qc),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/notifications/${notificationId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAllNotifications(qc),
  });
}

export function useDeleteReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId?: string) =>
      apiFetch('/notifications/read', {
        method: 'DELETE',
        body: JSON.stringify(projectId ? { projectId } : {}),
      }),
    onSuccess: () => invalidateAllNotifications(qc),
  });
}

export function useGlobalMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onSuccess: () => invalidateAllNotifications(qc),
  });
}

// -- Sprint Intelligence --

export interface ReleaseNoteItem {
  ticketId: string;
  title: string;
  headline: string;
}

export interface ReleaseNotes {
  version: string;
  summary: string;
  features: ReleaseNoteItem[];
  bugFixes: ReleaseNoteItem[];
  improvements: ReleaseNoteItem[];
  infrastructure: ReleaseNoteItem[];
  markdown: string;
  generatedAt: string;
}

// -- Release Notes --

export function useReleaseNotes(projectId: string, featureId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReleaseNotes | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ReleaseNotes>(`/projects/${projectId}/features/${featureId}/release-notes`, { method: 'POST' });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, result, setResult };
}

// -- Sprint Intelligence --

export function useSprintAnalysis() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<SprintAnalysis | null>(null);

  const analyze = async (projectId: string) => {
    setLoading(true);
    try {
      const result = await apiFetch<SprintAnalysis>(`/projects/${projectId}/sprint/analyze`, { method: 'POST' });
      setAnalysis(result);
      return result;
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, analysis, setAnalysis };
}

// -- Standup Report --

export interface StandupReport {
  yesterday: string[];
  today: string[];
  blockers: string[];
  confidence: number;
  reasoning: string;
}

export function useStandupReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StandupReport | null>(null);

  const generate = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<StandupReport>(`/projects/${projectId}/standup`, { method: 'POST' });
      setReport(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, report, setReport };
}

// -- Retrospective Report --

export interface RetrospectiveReport {
  wentWell: string[];
  improvements: string[];
  actionItems: string[];
  velocity: { planned: number; completed: number };
  confidence: number;
  reasoning: string;
}

export function useRetrospectiveReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<RetrospectiveReport | null>(null);

  const generate = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<RetrospectiveReport>(`/projects/${projectId}/retrospective`, { method: 'POST' });
      setReport(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, report, setReport };
}

// -- Sprint Plan --

export interface SprintPlanTicket {
  id: string;
  title: string;
  storyPoints: number;
  priority: string;
  reason: string;
}

export interface SprintPlan {
  recommendedTickets: SprintPlanTicket[];
  sprintGoal: string;
  estimatedPoints: number;
  capacityUtilization: number;
  risks: string[];
  confidence: number;
  reasoning: string;
}

export function useSprintPlan() {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SprintPlan | null>(null);

  const generate = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<SprintPlan>(`/projects/${projectId}/sprint-plan`, { method: 'POST' });
      setPlan(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, plan, setPlan };
}

export interface DimensionScore {
  score: number;
  label: string;
  note: string;
}

export interface TicketQualityResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    clarity: DimensionScore;
    completeness: DimensionScore;
    sizing: DimensionScore;
    specificity: DimensionScore;
    readiness: DimensionScore;
  };
  suggestions: string[];
  confidence: 'low' | 'medium' | 'high';
}

export function useTicketQuality() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TicketQualityResult | null>(null);

  const generate = async (ticketId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<TicketQualityResult>(`/tickets/${ticketId}/quality`, { method: 'POST' });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, result, setResult };
}

// -- Blocker & Dependency Analysis --

export interface DependencyEdge {
  fromTicketId: string;
  toTicketId: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  source: 'heuristic' | 'ai';
}

export interface TicketBlockerInfo {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  blockerScore: number;
  blocksCount: number;
  dependsOnCount: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface DependencyAnalysisResult {
  projectId: string;
  totalTickets: number;
  dependencyCount: number;
  criticalBlockers: TicketBlockerInfo[];
  allBlockers: TicketBlockerInfo[];
  edges: DependencyEdge[];
  riskSummary: string;
  analyzedAt: string;
}

export function useBlockerAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DependencyAnalysisResult | null>(null);

  const analyze = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<DependencyAnalysisResult>(`/projects/${projectId}/dependencies`, { method: 'POST' });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface PrioritizedTicket {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  storyPoints: number | null;
  priorityScore: number;
  priorityRank: number;
  rationale: string;
  dimensions: {
    impact: number;
    urgency: number;
    dependency: number;
    readiness: number;
  };
}

export interface PrioritizationResult {
  projectId: string;
  totalTickets: number;
  rankedTickets: PrioritizedTicket[];
  rationaleSummary: string;
  analyzedAt: string;
}

export function useTicketPrioritizer() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrioritizationResult | null>(null);

  const prioritize = async (projectId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<PrioritizationResult>(`/projects/${projectId}/prioritize`, { method: 'POST' });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { prioritize, loading, result, setResult };
}

export interface EpicHealthResult {
  epicId: string;
  epicTitle: string;
  healthScore: number;
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'healthy';
  totalTickets: number;
  dimensions: {
    completeness: number;
    velocity: number;
    readiness: number;
    scopeRisk: number;
  };
  ticketBreakdown: {
    idea: number;
    backlog: number;
    inProgress: number;
    review: number;
    done: number;
  };
  narrative: string;
  topRisk: string;
  analyzedAt: string;
}

export interface EpicSummary {
  epicId: string;
  epicTitle: string;
  totalTickets: number;
  completionRate: number;
  status: 'not_started' | 'in_progress' | 'complete';
}

export interface ProjectHealthResult {
  projectId: string;
  projectName: string;
  totalTickets: number;
  totalEpics: number;
  healthScore: number;
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'healthy';
  dimensions: {
    completion: number;
    velocity: number;
    quality: number;
    risk: number;
  };
  ticketBreakdown: {
    idea: number;
    backlog: number;
    inProgress: number;
    review: number;
    done: number;
  };
  epicSummaries: EpicSummary[];
  topBlockers: string[];
  executiveSummary: string;
  recommendedAction: string;
  analyzedAt: string;
}

export function useProjectHealth() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProjectHealthResult | null>(null);

  const analyze = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/health`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface DeadlineRiskResult {
  projectId: string;
  projectName: string;
  deadlineDate: string;
  analyzedAt: string;
  totalTickets: number;
  completedTickets: number;
  remainingTickets: number;
  daysRemaining: number;
  daysElapsed: number;
  velocityPerDay: number;
  requiredVelocity: number;
  velocityGap: number;
  projectedCompletionDate: string;
  willMeetDeadline: boolean;
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'ahead';
  narrative: string;
  recommendations: string[];
}

export function useDeadlineRisk() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeadlineRiskResult | null>(null);

  const analyze = async (projectId: string, deadlineDate: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<DeadlineRiskResult>(`/projects/${projectId}/deadline-risk`, {
        method: 'POST',
        body: JSON.stringify({ deadlineDate }),
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export function useEpicHealth() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EpicHealthResult | null>(null);

  const analyze = async (epicId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<EpicHealthResult>(`/epics/${epicId}/health`, { method: 'POST' });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}
