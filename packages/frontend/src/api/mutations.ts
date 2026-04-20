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

export interface ReadinessCheck {
  name: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
}

export interface ReleaseReadinessResult {
  projectId: string;
  featureId?: string;
  verdict: 'ready' | 'not_ready' | 'conditional';
  checks: ReadinessCheck[];
  totalTickets: number;
  doneTickets: number;
  completionPercent: number;
  narrative: string;
  topConcern: string;
  analyzedAt: string;
}

export function useReleaseReadiness() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReleaseReadinessResult | null>(null);

  const check = async (projectId: string, featureId?: string): Promise<void> => {
    setLoading(true);
    try {
      const url = featureId
        ? `/projects/${projectId}/release-readiness?featureId=${featureId}`
        : `/projects/${projectId}/release-readiness`;
      const data = await apiFetch<ReleaseReadinessResult>(url, { method: 'POST' });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { check, loading, result, setResult };
}

export interface TriageResult {
  ticketId: string;
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  suggestedStoryPoints: number;
  suggestedEpicId: string | null;
  suggestedEpicName: string | null;
  suggestedAssignee: string | null;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  analyzedAt: string;
}

export function useTicketTriage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);

  const triage = async (ticketId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<TriageResult>(`/tickets/${ticketId}/triage`, { method: 'POST' });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  return { triage, loading, result, setResult };
}

export interface AssigneeLoad {
  assignee: string;
  ticketCount: number;
  totalStoryPoints: number;
  loadScore: number;
  status: 'overloaded' | 'balanced' | 'underloaded';
}

export interface WorkloadRecommendation {
  fromAssignee: string;
  toAssignee: string;
  ticketId: string;
  ticketTitle: string;
  reason: string;
}

export interface WorkloadAnalysis {
  projectId: string;
  featureId: string | null;
  assigneeLoads: AssigneeLoad[];
  recommendations: WorkloadRecommendation[];
  overallBalance: 'well-balanced' | 'moderate-imbalance' | 'severe-imbalance';
  narrative: string;
  analyzedAt: string;
}

export function useWorkloadBalance() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkloadAnalysis | null>(null);

  const balance = async (projectId: string, featureId?: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<WorkloadAnalysis>(`/projects/${projectId}/workload-balance`, {
        method: 'POST',
        body: featureId ? JSON.stringify({ featureId }) : undefined,
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { balance, loading, result, setResult };
}

export interface AgentMetrics {
  agentName: string;
  completedTickets: number;
  inProgressTickets: number;
  totalStoryPointsDelivered: number;
  avgStoryPointsPerTicket: number;
  completionRate: number;
  topTicketTypes: string[];
  performanceTier: 'high' | 'medium' | 'low';
}

export interface AgentPerformanceReport {
  projectId: string;
  agents: AgentMetrics[];
  topPerformer: string | null;
  insight: string;
  analyzedAt: string;
}

export function useAgentPerformance() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentPerformanceReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentPerformanceReport>(`/projects/${projectId}/agent-performance`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentRouting {
  agentName: string;
  score: number;
  reason: string;
}

export interface RoutingRecommendation {
  ticketId: string;
  ticketTitle: string;
  ticketPriority: string;
  rankedAgents: AgentRouting[];
}

export interface RoutingReport {
  projectId: string;
  unassignedCount: number;
  recommendations: RoutingRecommendation[];
  rationale: string;
  analyzedAt: string;
}

export function useAgentRouting() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutingReport | null>(null);

  const route = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<RoutingReport>(`/projects/${projectId}/agent-routing`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { route, loading, result, setResult };
}

export interface StaleTicket {
  ticketId: string;
  title: string;
  priority: string;
  status: string;
  staleDays: number;
  assignedPersona: string | null;
  riskLevel: 'critical' | 'high' | 'medium';
  recommendation: string;
}

export interface EscalationReport {
  projectId: string;
  staleTickets: StaleTicket[];
  totalStale: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  analyzedAt: string;
}

export function useEscalationDetect() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EscalationReport | null>(null);

  const detect = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<EscalationReport>(`/projects/${projectId}/escalation-detect`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { detect, loading, result, setResult };
}

export interface AgentSkillProfile {
  agentName: string;
  totalAssigned: number;
  completedCount: number;
  completionRate: number;
  avgStoryPoints: number;
  complexityScore: number;
  specialization: string | null;
  proficiencyTier: 'expert' | 'proficient' | 'developing';
  priorityBreakdown: { critical: number; high: number; medium: number; low: number };
}

export interface SkillProfileReport {
  projectId: string;
  profiles: AgentSkillProfile[];
  topExpert: string | null;
  insight: string;
  analyzedAt: string;
}

export function useAgentSkillProfiles() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillProfileReport | null>(null);

  const profile = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<SkillProfileReport>(`/projects/${projectId}/agent-skill-profiles`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, result, setResult };
}

export interface CollaborationPair {
  primaryAgent: string;
  secondaryAgent: string;
  collaborationScore: number;
  rationale: string;
  suggestedSplit: string;
}

export interface CollaborationTicket {
  ticketId: string;
  ticketTitle: string;
  ticketPriority: string;
  detectedSpecializations: string[];
  recommendedPairs: CollaborationPair[];
}

export interface CollaborationReport {
  projectId: string;
  complexTickets: CollaborationTicket[];
  analyzedAt: string;
}

export function useAgentCollaboration() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollaborationReport | null>(null);

  const collaborate = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<CollaborationReport>(`/projects/${projectId}/agent-collaboration`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { collaborate, loading, result, setResult };
}

export interface AgentBurnoutStatus {
  agentName: string;
  activeCount: number;
  avgStaleDays: number;
  storyPointLoad: number;
  riskLevel: 'critical' | 'high' | 'medium';
  overloaded: boolean;
  degrading: boolean;
  recommendation: string;
}

export interface BurnoutReport {
  projectId: string;
  atRiskAgents: AgentBurnoutStatus[];
  totalAgents: number;
  atRiskCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  analyzedAt: string;
}

export function useAgentBurnout() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BurnoutReport | null>(null);

  const detect = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<BurnoutReport>(`/projects/${projectId}/agent-burnout`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { detect, loading, result, setResult };
}

export interface PriorityGap {
  priority: 'critical' | 'high' | 'medium' | 'low';
  openTickets: number;
  unassignedCount: number;
  assignedAgents: string[];
  gapSeverity: 'critical' | 'moderate' | 'none';
}

export interface KnowledgeGapReport {
  projectId: string;
  gaps: PriorityGap[];
  topGap: string | null;
  insight: string;
  analyzedAt: string;
}

export function useAgentKnowledgeGaps() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KnowledgeGapReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<KnowledgeGapReport>(`/projects/${projectId}/agent-knowledge-gaps`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface HandoffIssue {
  category: 'missing-context' | 'vague-instructions' | 'no-acceptance-criteria' | 'missing-artifacts' | 'unclear-scope';
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface HandoffQualityScore {
  handoffId: string;
  ticketId: string;
  ticketTitle: string;
  fromAgent: string;
  toAgent: string;
  score: number;
  grade: 'excellent' | 'good' | 'needs-improvement' | 'poor';
  issues: HandoffIssue[];
  suggestions: string[];
  analyzedAt: string;
}

export interface HandoffQualityReport {
  projectId: string;
  totalHandoffs: number;
  averageScore: number;
  excellentCount: number;
  goodCount: number;
  needsImprovementCount: number;
  poorCount: number;
  handoffs: HandoffQualityScore[];
  topIssues: { category: string; count: number }[];
  analyzedAt: string;
}

export function useAgentHandoffQuality() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HandoffQualityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<HandoffQualityReport>(`/projects/${projectId}/agent-handoff-quality`, {
        method: 'POST',
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

export interface SequencedTicket {
  ticketId: string; title: string; priority: string | null; storyPoints: number | null;
  status: string; dueDate: string | null; score: number; rationale: string;
}
export interface AgentTaskSequence { agentName: string; ticketCount: number; sequence: SequencedTicket[]; }
export interface TaskSequenceReport { projectId: string; agentSequences: AgentTaskSequence[]; totalAgents: number; totalTickets: number; generatedAt: string; }

export function useAgentTaskSequence() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskSequenceReport | null>(null);
  const sequence = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<TaskSequenceReport>(`/projects/${projectId}/agent-task-sequence`, { method: 'POST' });
      setResult(data);
    } finally { setLoading(false); }
  };
  return { sequence, loading, result, setResult };
}

export interface AgentVelocity {
  agentName: string;
  recentPoints: number;
  priorPoints: number;
  recentCount: number;
  priorCount: number;
  forecastPoints: number;
  trend: 'up' | 'down' | 'stable' | 'new';
  recommendation: string;
}

export interface VelocityForecastReport {
  projectId: string;
  agentVelocities: AgentVelocity[];
  totalAgents: number;
  totalForecastPoints: number;
  topAgent: string | null;
  atRiskAgents: string[];
  generatedAt: string;
}

export function useAgentVelocityForecast() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VelocityForecastReport | null>(null);

  const forecast = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<VelocityForecastReport>(`/projects/${projectId}/agent-velocity-forecast`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { forecast, loading, result, setResult };
}

export interface AgentLoadForecast {
  agentType: string;
  currentLoad: number;
  predictedLoad: number;
  capacityUtilization: number;
  riskLevel: 'critical' | 'high' | 'moderate' | 'low';
  recommendation: string;
}

export interface LoadPredictionReport {
  projectId: string;
  forecastWindow: string;
  totalTicketsPipeline: number;
  overloadedAgents: number;
  agentForecasts: AgentLoadForecast[];
  bottleneckWarnings: string[];
  aiInsight: string;
  analyzedAt: string;
}

export interface AgentCommitmentRecord {
  agentType: string;
  plannedTickets: number;
  completedTickets: number;
  commitmentRatio: number;
  status: 'overcommitted' | 'on-track' | 'underutilized';
  statusExplanation: string;
}

export interface SprintCommitmentReport {
  projectId: string;
  sprintWindowDays: 14;
  totalPlanned: number;
  totalCompleted: number;
  overallCommitmentRatio: number;
  overcommittedAgents: number;
  onTrackAgents: number;
  underutilizedAgents: number;
  agentRecords: AgentCommitmentRecord[];
  aiRecommendation: string;
  analyzedAt: string;
}

export function useAgentSprintCommitment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SprintCommitmentReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<SprintCommitmentReport>(`/projects/${projectId}/agent-sprint-commitment`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export function useAgentLoadPredictor() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LoadPredictionReport | null>(null);

  const predict = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<LoadPredictionReport>(`/projects/${projectId}/agent-load-predictor`, { method: 'POST' });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { predict, loading, result, setResult };
}

export interface CollaborationLink {
  fromAgent: string;
  toAgent: string;
  handoffCount: number;
  collaborationStrength: 'strong' | 'moderate' | 'weak';
}

export interface CollaborationNetworkReport {
  projectId: string;
  totalHandoffsAnalyzed: number;
  totalAgentsInNetwork: number;
  mostCollaborativeAgent: string | null;
  isolatedAgents: string[];
  strongLinks: CollaborationLink[];
  allLinks: CollaborationLink[];
  networkInsight: string;
  analyzedAt: string;
}

export function useAgentCollaborationNetwork(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollaborationNetworkReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<CollaborationNetworkReport>(`/projects/${projectId}/agent-collaboration-network`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentContextScore {
  agentType: string;
  ticketsHandled: number;
  midFlowPickups: number;
  escalationRate: number;
  contextRetentionScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeExplanation: string;
}

export interface ContextRetentionReport {
  projectId: string;
  totalTicketsAnalyzed: number;
  avgRetentionScore: number;
  topPerformer: string | null;
  needsAttention: string[];
  agentScores: AgentContextScore[];
  aiRecommendation: string;
  analyzedAt: string;
}

export function useAgentContextRetention(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContextRetentionReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<ContextRetentionReport>(`/projects/${projectId}/agent-context-retention`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentFocusAdvice {
  agentName: string;
  inProgressCount: number;
  staleCount: number;
  focusRisk: 'overloaded' | 'stale' | 'idle' | 'balanced';
  topStaleTicket: { id: string; title: string } | null;
  recommendation: string;
}

export interface FocusAdvisorReport {
  projectId: string;
  agentAdvice: AgentFocusAdvice[];
  totalAgents: number;
  overloadedAgents: number;
  idleAgents: number;
  staleAgents: number;
  generatedAt: string;
}

export function useAgentFocusAdvisor() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FocusAdvisorReport | null>(null);

  const advise = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<FocusAdvisorReport>(`/projects/${projectId}/agent-focus-advisor`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { advise, loading, result, setResult };
}

export interface AgentResponseProfile {
  agentName: string;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  ticketsActedOn: number;
  unstartedTickets: number;
  responseCategory: 'fast' | 'normal' | 'slow';
  recommendation: string;
}

export interface ResponseTimeReport {
  projectId: string;
  agentProfiles: AgentResponseProfile[];
  totalAgents: number;
  slowAgents: number;
  fastAgents: number;
  avgProjectResponseMs: number;
  generatedAt: string;
}

export function useAgentResponseTime() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResponseTimeReport | null>(null);

  const profile = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<ResponseTimeReport>(`/projects/${projectId}/agent-response-time`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, result, setResult };
}

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AgentPriorityRecord {
  agentPersona: string;
  totalActiveTickets: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  highestPriorityWorking: TicketPriority | null;
  lowestPriorityWorking: TicketPriority | null;
  alignmentScore: number;
  alignmentStatus: 'aligned' | 'drifting' | 'misaligned';
  explanation: string;
}

export interface PriorityAlignmentReport {
  projectId: string;
  analyzedAt: string;
  totalAgentsAnalyzed: number;
  totalActiveTickets: number;
  alignedAgents: number;
  driftingAgents: number;
  misalignedAgents: number;
  agentRecords: AgentPriorityRecord[];
  aiRecommendation: string;
}

export function useAgentPriorityAlignment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PriorityAlignmentReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<PriorityAlignmentReport>(`/projects/${projectId}/agent-priority-alignment`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export type StallSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface StalledTicket {
  ticketId: string;
  title: string;
  status: string;
  assignedPersona: string;
  stalledForHours: number;
  severity: StallSeverity;
}

export interface AgentStallSummary {
  agentPersona: string;
  stalledCount: number;
  avgStalledHours: number;
  worstStallHours: number;
  stalledTickets: StalledTicket[];
}

export interface StallDetectionReport {
  projectId: string;
  totalStalledTickets: number;
  criticalStalls: number;
  agentSummaries: AgentStallSummary[];
  mostStalledAgent: string | null;
  aiRecommendation: string;
  analyzedAt: string;
}

export function useAgentStallDetector() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StallDetectionReport | null>(null);

  const detect = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<StallDetectionReport>(`/projects/${projectId}/agent-stall-detector`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { detect, loading, result, setResult };
}

export type SpecializationStrength = 'strong' | 'moderate' | 'generalist';

export interface AgentSpecialization {
  agentPersona: string;
  totalCompleted: number;
  topLabels: string[];
  completionRate: number;
  avgCompletionTimeMs: number;
  specializationStrength: SpecializationStrength;
  recommendation: string;
}

export interface SpecializationReport {
  projectId: string;
  analyzedAt: string;
  totalAgents: number;
  specialistAgents: number;
  generalistAgents: number;
  agentProfiles: AgentSpecialization[];
  topLabel: string | null;
  aiSummary: string;
}

export function useAgentSpecializationMapper() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpecializationReport | null>(null);

  const map = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<SpecializationReport>(
        `/projects/${projectId}/agent-specialization-mapper`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { map, loading, result, setResult };
}


export interface StageBottleneck {
  stage: 'in_progress' | 'review' | 'qa' | 'acceptance';
  avgDwellMs: number;
  maxDwellMs: number;
  ticketCount: number;
  bottleneckSeverity: 'critical' | 'moderate' | 'low';
}

export interface AgentBottleneck {
  agentPersona: string;
  avgDwellMs: number;
  stalledTickets: number;
  totalAssigned: number;
  bottleneckScore: number;
  recommendation: string;
}

export interface BottleneckReport {
  projectId: string;
  analyzedAt: string;
  totalTickets: number;
  stalledTickets: number;
  criticalBottlenecks: number;
  stageBottlenecks: StageBottleneck[];
  agentBottlenecks: AgentBottleneck[];
  aiSummary: string;
}

export function useAgentBottleneckAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BottleneckReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<BottleneckReport>(
        `/projects/${projectId}/agent-bottleneck-analyzer`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentQueueProfile {
  agentPersona: string;
  queueDepth: number;
  criticalQueued: number;
  highQueued: number;
  activeTickets: number;
  totalLoad: number;
  overflowRisk: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface QueueDepthReport {
  projectId: string;
  agentProfiles: AgentQueueProfile[];
  totalAgents: number;
  overloadedAgents: number;
  idleAgents: number;
  avgQueueDepth: number;
  generatedAt: string;
}

export function useAgentQueueDepth() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueueDepthReport | null>(null);

  const monitor = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<QueueDepthReport>(
        `/projects/${projectId}/agent-queue-depth`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { monitor, loading, result, setResult };
}

export type GapSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface SkillGapEntry {
  label: string;
  totalTickets: number;
  completedTickets: number;
  stalledTickets: number;
  completionRate: number;
  coveredByAgents: string[];
  gapSeverity: GapSeverity;
  recommendation: string;
}

export interface SkillGapReport {
  projectId: string;
  analyzedAt: string;
  totalLabels: number;
  criticalGaps: number;
  coveredLabels: number;
  skillGaps: SkillGapEntry[];
  aiSummary: string;
}

export function useAgentSkillGap() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillGapReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<SkillGapReport>(
        `/projects/${projectId}/agent-skill-gap`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export type ConflictSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface DomainConflict {
  domain: string;
  domainType: 'label' | 'epic';
  agents: string[];
  activeTickets: number;
  totalTickets: number;
  conflictScore: number;
  severity: ConflictSeverity;
  recommendation: string;
}

export interface ConflictReport {
  projectId: string;
  analyzedAt: string;
  totalConflicts: number;
  criticalConflicts: number;
  cleanDomains: number;
  domainConflicts: DomainConflict[];
  aiSummary: string;
}

export function useAgentConflictDetector() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConflictReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<ConflictReport>(
        `/projects/${projectId}/agent-conflict-detector`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export type QualityRating = 'excellent' | 'good' | 'needs_improvement' | 'poor';

export interface AgentDecisionQuality {
  agentPersona: string;
  totalTickets: number;
  completedTickets: number;
  regressionCount: number;
  revisionRate: number;
  qualityScore: number;
  rating: QualityRating;
  recommendation: string;
}

export interface DecisionQualityReport {
  projectId: string;
  analyzedAt: string;
  totalAgents: number;
  poorQualityAgents: number;
  excellentAgents: number;
  avgQualityScore: number;
  agentQualities: AgentDecisionQuality[];
  aiSummary: string;
}

export function useAgentDecisionQuality() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionQualityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<DecisionQualityReport>(
        `/projects/${projectId}/agent-decision-quality`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentTrendMetrics {
  completionRate: number;
  stallRate: number;
  avgResolutionDays: number;
  ticketVolume: number;
}

export interface AgentPerformanceTrend {
  agentName: string;
  recent: AgentTrendMetrics;
  baseline: AgentTrendMetrics;
  trendDirection: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  completionRateDelta: number;
  stallRateDelta: number;
  recommendation: string;
}

export interface PerformanceTrendReport {
  projectId: string;
  analyzedAt: string;
  windowDays: number;
  totalAgents: number;
  improvingAgents: number;
  decliningAgents: number;
  stableAgents: number;
  agentTrends: AgentPerformanceTrend[];
  aiSummary: string;
}

export function useAgentPerformanceTrend() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PerformanceTrendReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<PerformanceTrendReport>(
        `/projects/${projectId}/agent-performance-trend`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface CoverageArea {
  areaType: 'status' | 'epic' | 'label';
  areaId: string;
  areaName: string;
  activeTickets: number;
  agentsCovering: number;
  lastAgentActivity: string | null;
  gapSeverity: 'critical' | 'high' | 'moderate' | 'low';
  recommendation: string;
}

export interface CoverageGapReport {
  projectId: string;
  analyzedAt: string;
  totalAreas: number;
  coveredAreas: number;
  uncoveredAreas: number;
  criticalGaps: number;
  coverageScore: number;
  areas: CoverageArea[];
  aiSummary: string;
}

export function useAgentCoverageGap() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverageGapReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<CoverageGapReport>(
        `/projects/${projectId}/agent-coverage-gap`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentDependencyEdge {
  blockingAgent: string;
  waitingAgent: string;
  blockedTickets: number;
  totalBlockingTickets: number;
  blockingScore: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  recommendation: string;
}

export interface AgentDependencyMapReport {
  projectId: string;
  analyzedAt: string;
  totalEdges: number;
  criticalEdges: number;
  independentAgents: number;
  agentDependencyEdges: AgentDependencyEdge[];
  aiSummary: string;
}

export interface AgentContextProfile {
  agentPersona: string;
  totalTickets: number;
  ticketsWithDescription: number;
  ticketsWithLinkedHandoffs: number;
  avgDescriptionLength: number;
  contextScore: number;
  contextRating: 'excellent' | 'good' | 'poor' | 'critical';
  recommendation: string;
}

export interface ContextUtilizationReport {
  projectId: string;
  analyzedAt: string;
  profiles: AgentContextProfile[];
  summary: string;
  criticalAgents: string[];
}

export function useAgentContextUtilization() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContextUtilizationReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<ContextUtilizationReport>(
        `/projects/${projectId}/agent-context-utilization`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface HandoffPair {
  fromAgent: string;
  toAgent: string;
  totalHandoffs: number;
  successfulHandoffs: number;
  stalledHandoffs: number;
  successRate: number;
  rating: 'excellent' | 'good' | 'poor' | 'critical';
  recommendation: string;
}

export interface HandoffSuccessReport {
  projectId: string;
  analyzedAt: string;
  totalPairs: number;
  criticalPairs: number;
  avgSuccessRate: number;
  pairs: HandoffPair[];
  aiSummary: string;
}

export function useAgentHandoffSuccess() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HandoffSuccessReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<HandoffSuccessReport>(
        `/projects/${projectId}/agent-handoff-success`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export function useAgentDependencyMapper() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDependencyMapReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentDependencyMapReport>(
        `/projects/${projectId}/agent-dependency-mapper`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}
