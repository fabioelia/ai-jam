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

export interface AgentHandoffQualityMetrics {
  agentId: string;
  agentName: string;
  totalHandoffs: number;
  avgContextCompleteness: number;
  avgClarityScore: number;
  avgTimeliness: number;
  followUpRate: number;
  handoffScore: number;
  handoffTier: 'exemplary' | 'proficient' | 'adequate' | 'deficient';
}

export interface AgentHandoffQualityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgHandoffScore: number;
    bestHandoffAgent: string;
    worstHandoffAgent: string;
    highQualityHandoffCount: number;
  };
  agents: AgentHandoffQualityMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentHandoffQuality() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentHandoffQualityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentHandoffQualityReport>(`/projects/${projectId}/agent-handoff-quality`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, setResult, analyze };
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

export interface AgentContextRetentionMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalHandoffsReceived: number;
  avgContextFieldsProvided: number;
  contextReferenceRate: number;
  crossSessionCoherence: number;
  contextRetentionScore: number;
  retentionTier: 'exemplary' | 'proficient' | 'adequate' | 'fragmented';
}

export interface AgentContextRetentionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgRetentionScore: number;
    topContextUser: string;
    exemplaryCount: number;
  };
  agents: AgentContextRetentionMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentContextRetention(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentContextRetentionReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentContextRetentionReport>(`/projects/${projectId}/agent-context-retention`, {
        method: 'POST',
      });
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, data, setData };
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

export interface AgentPriorityAlignmentData {
  agentId: string;
  agentName: string;
  criticalResolutionRate: number;
  highPriorityFocusRate: number;
  avgCriticalTimeHours: number;
  avgLowTimeHours: number;
  priorityAlignmentScore: number;
  alignmentTier: 'aligned' | 'balanced' | 'inconsistent' | 'misaligned';
}

export interface PriorityAlignmentReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAlignmentScore: number;
    mostAligned: string;
    leastAligned: string;
    criticalBacklogCount: number;
  };
  agents: AgentPriorityAlignmentData[];
  insights: string[];
  recommendations: string[];
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

export type IdleStatus = 'overloaded' | 'active' | 'underutilized' | 'idle';

export interface AgentIdleTimeStats {
  agentPersona: string;
  totalTickets: number;
  idleGapHours: number;
  longestIdleGap: number;
  utilizationRate: number;
  status: IdleStatus;
}

export interface AgentIdleTimeAnalysis {
  projectId: string;
  analyzedAt: string;
  agents: AgentIdleTimeStats[];
  avgIdleGapHours: number;
  mostIdleAgent: string | null;
  totalIdleRisk: number;
  overallUtilization: number;
  summary: string;
  recommendations: string[];
}

export function useAgentIdleTime() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentIdleTimeAnalysis | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentIdleTimeAnalysis>(
        `/projects/${projectId}/agent-idle-time`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentThroughputMetrics {
  agentPersona: string;
  completedTickets: number;
  totalTickets: number;
  avgCycleTimeHours: number;
  throughputScore: number;
  rank: number;
  recommendation: string;
}

export interface ThroughputEfficiencyReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentThroughputMetrics[];
  topAgent: string | null;
  bottomAgent: string | null;
  avgThroughputScore: number;
  summary: string;
  recommendations: string[];
}

export function useAgentThroughputEfficiency() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThroughputEfficiencyReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<ThroughputEfficiencyReport>(
        `/projects/${projectId}/agent-throughput-efficiency`,
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

export interface AgentFairnessMetrics {
  agentPersona: string;
  activeTickets: number;
  completedLast7d: number;
  workloadShare: number;
  idealShare: number;
  deviation: number;
  status: 'overloaded' | 'balanced' | 'underloaded';
}

export interface WorkloadFairnessReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentFairnessMetrics[];
  fairnessScore: number;
  totalActiveTickets: number;
  summary: string;
}

export function useAgentWorkloadFairness() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkloadFairnessReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<WorkloadFairnessReport>(
        `/projects/${projectId}/agent-workload-fairness`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentErrorMetrics {
  agentPersona: string;
  totalTasks: number;
  failedTasks: number;
  retriedTasks: number;
  errorRate: number;
  retryRate: number;
  reliabilityScore: number;
  classification: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentErrorRateReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentErrorMetrics[];
  criticalCount: number;
  avgReliabilityScore: number;
  mostReliableAgent: string | null;
  leastReliableAgent: string | null;
  aiSummary: string;
  recommendations: string[];
}

export function useAgentErrorRates() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentErrorRateReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentErrorRateReport>(
        `/projects/${projectId}/agent-error-rates`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface EscalationChain {
  fromAgent: string;
  toAgent: string;
  count: number;
}

export interface EscalationHotspot {
  agentPersona: string;
  escalationCount: number;
  severity: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentEscalationPatternReport {
  projectId: string;
  analyzedAt: string;
  chains: EscalationChain[];
  hotspots: EscalationHotspot[];
  circularPatterns: string[][];
  totalEscalations: number;
  avgChainLength: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentEscalationPatterns() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentEscalationPatternReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentEscalationPatternReport>(
        `/projects/${projectId}/agent-escalation-pattern`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentGoalAlignment {
  agentPersona: string;
  tasksCompleted: number;
  tasksInScope: number;
  tasksOutOfScope: number;
  alignmentScore: number;
  driftRate: number;
  classification: 'aligned' | 'partial' | 'drifted';
}

export interface GoalAlignmentReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentGoalAlignment[];
  summary: {
    totalAgents: number;
    avgAlignmentScore: number;
    driftedAgents: number;
    mostAlignedAgent: string | null;
  };
  aiSummary: string;
}

export function useAgentGoalAlignment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GoalAlignmentReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<GoalAlignmentReport>(
        `/projects/${projectId}/agent-goal-alignment`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface RecoveryEvent {
  ticketId: string;
  agentPersona: string;
  status: string;
  recoveryMethod: 'self' | 'handoff' | 'escalation' | 'unresolved';
  cycleTimeHours: number;
}

export interface AgentRecoveryProfile {
  agentPersona: string;
  totalFailureEvents: number;
  recoveredCount: number;
  failedToRecover: number;
  recoveryRate: number;
  avgRecoveryTimeHours: number;
  selfRecoveryRate: number;
}

export interface RecoveryPatternReport {
  projectId: string;
  analyzedAt: string;
  totalFailureEvents: number;
  overallRecoveryRate: number;
  avgRecoveryTimeHours: number;
  agentProfiles: AgentRecoveryProfile[];
  recentEvents: RecoveryEvent[];
  aiInsights: string;
  recommendations: string[];
}

export function useAgentRecoveryPatterns() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecoveryPatternReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<RecoveryPatternReport>(
        `/projects/${projectId}/agent-recovery-patterns`,
        { method: 'GET' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface StatusDuration {
  status: string;
  avgHoursHeld: number;
  isBottleneck: boolean;
}

export interface AgentVelocityMetrics {
  agentPersona: string;
  avgTotalCycleHours: number;
  velocityScore: number;
  rating: 'fast' | 'normal' | 'slow' | 'bottleneck';
  statusDurations: StatusDuration[];
  completedTickets: number;
}

export interface AgentTaskVelocityReport {
  projectId: string;
  analyzedAt: string;
  totalAgents: number;
  bottleneckAgents: number;
  fastestAgent: string | null;
  slowestAgent: string | null;
  agents: AgentVelocityMetrics[];
  aiSummary: string;
}

export function useAgentTaskVelocity() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTaskVelocityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentTaskVelocityReport>(
        `/projects/${projectId}/agent-task-velocity`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentContextSwitchMetrics {
  agentPersona: string;
  totalTickets: number;
  contextSwitches: number;
  switchRate: number;
  focusScore: number;
  rating: 'focused' | 'moderate' | 'scattered' | 'chaotic';
  avgSwitchesPerDay: number;
  dominantEpic: string | null;
}

export interface AgentContextSwitchReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentContextSwitchMetrics[];
  totalSwitches: number;
  avgSwitchRate: number;
  mostScatteredAgent: string | null;
  focusedAgentCount: number;
  aiSummary: string;
  recommendations: string[];
}

export function useAgentContextSwitch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentContextSwitchReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentContextSwitchReport>(
        `/projects/${projectId}/agent-context-switch`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentParallelMetrics {
  agentPersona: string;
  currentParallelCount: number;
  efficiencyScore: number;
  rating: 'optimal' | 'loaded' | 'overloaded' | 'saturated';
}

export interface AgentParallelCapacityReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentParallelMetrics[];
  maxParallelLoad: number;
  avgParallelLoad: number;
  overloadedAgentCount: number;
  optimalConcurrency: number;
  aiSummary: string;
  recommendations: string[];
}

export function useAgentParallelCapacity() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentParallelCapacityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentParallelCapacityReport>(
        `/projects/${projectId}/agent-parallel-capacity`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentEstimationData {
  agentId: string;
  agentName: string;
  estimationsProvided: number;
  estimationsWithinRange: number;
  avgEstimationError: number;
  overestimationRate: number;
  underestimationRate: number;
  estimationBias: 'optimistic' | 'pessimistic' | 'accurate' | 'none';
  estimationScore: number;
  estimationTier: 'precise' | 'reasonable' | 'unreliable' | 'erratic';
}

export interface AgentEstimationAccuracyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgEstimationScore: number;
    mostPreciseAgent: string;
    mostErraticAgent: string;
    accurateEstimationCount: number;
  };
  agents: AgentEstimationData[];
  insights: string[];
  recommendations: string[];
}

export function useAgentEstimationAccuracy() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentEstimationAccuracyReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentEstimationAccuracyReport>(
        `/projects/${projectId}/agent-estimation-accuracy`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentOutputQualityAgent {
  personaId: string;
  qualityScore: number;
  acceptanceRate: number;
  reworkRate: number;
  completenessScore: number;
  formattingComplianceRate: number;
  totalOutputs: number;
  acceptedOutputs: number;
  reworkedOutputs: number;
  qualityTier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentOutputQualityReport {
  agents: AgentOutputQualityAgent[];
  avgQualityScore: number;
  highestQuality: string | null;
  lowestQuality: string | null;
  mostReworked: string | null;
  systemAcceptanceRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const getAgentOutputQuality = (projectId: string) =>
  fetch(`/api/projects/${projectId}/agent-output-quality`, { method: 'POST' }).then((r) => r.json());

export interface AgentCommunicationProfile {
  agentPersona: string;
  handoffsSent: number;
  avgMessageLength: number;
  contextRichness: number;
  clarificationRate: number;
  downstreamSuccessRate: number;
  qualityScore: number;
  tier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface CommunicationPattern {
  pattern: string;
  frequency: number;
  impact: 'positive' | 'negative';
}

export interface CommunicationQualityReport {
  agents: AgentCommunicationProfile[];
  patterns: CommunicationPattern[];
  summary: {
    totalAgents: number;
    avgQualityScore: number;
    excellentCount: number;
    poorCount: number;
    bestCommunicator: string | null;
    worstCommunicator: string | null;
  };
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentCommunicationQuality() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommunicationQualityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<CommunicationQualityReport>(
        `/projects/${projectId}/agent-communication-quality`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentTaskAbandonmentData {
  agentId: string;
  agentName: string;
  tasksStarted: number;
  tasksAbandoned: number;
  tasksCompleted: number;
  abandonmentRate: number;
  avgAbandonmentPoint: number;
  topAbandonmentReason: string;
  abandonmentScore: number;
  abandonmentTier: 'reliable' | 'moderate' | 'inconsistent' | 'volatile';
}

export interface AgentTaskAbandonmentReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalTasksStarted: number;
    totalTasksAbandoned: number;
    avgAbandonmentRate: number;
    mostReliableAgent: string;
    mostVolatileAgent: string;
    lowAbandonmentCount: number;
  };
  agents: AgentTaskAbandonmentData[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentTaskAbandonment() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTaskAbandonmentReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentTaskAbandonmentReport>(
        `/projects/${projectId}/agent-task-abandonment`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}


export interface AgentWorkloadMetrics {
  personaId: string;
  totalSessions: number;
  totalTickets: number;
  workloadShare: number; // 0-100
  overloadRisk: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentWorkloadDistributionReport {
  projectId: string;
  agents: AgentWorkloadMetrics[];
  totalProjectTickets: number;
  mostLoadedAgent: string | null;
  leastLoadedAgent: string | null;
  workloadGiniCoefficient: number; // 0-1
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentWorkloadDistribution() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentWorkloadDistributionReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentWorkloadDistributionReport>(
        `/projects/${projectId}/agent-workload-distribution`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentTaskComplexity {
  personaId: string;
  totalTickets: number;
  avgTransitionsPerTicket: number;
  avgHandoffChainDepth: number;
  reworkRate: number;
  epicLinkRate: number;
  complexityScore: number;
  complexityTier: 'specialist' | 'capable' | 'generalist' | 'underutilized';
}

export interface AgentTaskComplexityReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentTaskComplexity[];
  summary: {
    totalAgentsAnalyzed: number;
    avgComplexityScore: number;
    highestComplexityAgent: string | null;
    lowestComplexityAgent: string | null;
  };
}

/** @deprecated use AgentTaskComplexityReport */
export type TaskComplexityReport = AgentTaskComplexityReport;

export function useAgentTaskComplexity() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTaskComplexityReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-task-complexity`, { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentSessionDepthProfile {
  personaId: string;
  avgTicketsPerSession: number;
  avgHandoffsSentPerSession: number;
  avgHandoffsReceivedPerSession: number;
  avgSessionDurationHours: number;
  totalSessions: number;
  depthScore: number;
  depthCategory: 'deep' | 'moderate' | 'shallow' | 'pass-through';
}

export interface AgentSessionDepthReport {
  agents: AgentSessionDepthProfile[];
  avgDepthScore: number;
  deepestAgent: string | null;
  shallowestAgent: string | null;
  passThroughCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSessionDepth() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSessionDepthReport | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentSessionDepthReport>(
        `/projects/${projectId}/agent-session-depth`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentFeedbackLoopMetrics {
  personaId: string;
  totalFeedbackEvents: number;
  improvementRate: number;
  averageRecoveryTime: number;
  feedbackResponsiveness: 'high' | 'medium' | 'low' | 'none';
  recentTrend: 'improving' | 'stable' | 'degrading';
}

export function useAgentFeedbackLoops() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentFeedbackLoopMetrics[] | null>(null);

  const analyze = async (projectId: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentFeedbackLoopMetrics[]>(
        `/agent-feedback-loops/${projectId}`,
        { method: 'GET' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentReassignmentMetrics {
  agentPersona: string;
  ticketsReceived: number;
  ticketsReassignedAway: number;
  ticketsReassignedIn: number;
  reassignmentAwayRate: number;
  avgHeldDuration: number;
  stabilityScore: number;
  stabilityLevel: 'stable' | 'moderate' | 'volatile' | 'critical';
}

export interface ReassignmentHotspot {
  fromPersona: string;
  toPersona: string;
  count: number;
}

export interface AgentReassignmentReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentReassignmentMetrics[];
  hotspots: ReassignmentHotspot[];
  summary: {
    totalAgents: number;
    totalReassignments: number;
    avgReassignmentAwayRate: number;
    mostStableAgent: string | null;
    mostVolatileAgent: string | null;
  };
  aiSummary: string;
}

export function useAgentReassignmentRates() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentReassignmentReport | null>(null);

  const analyze = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-reassignment-rates`, { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}


export interface WeeklySnapshot {
  weekStart: string;
  ticketsCompleted: number;
  avgCompletionTimeHours: number;
  qualityScore: number;
  handoffSuccessRate: number;
}

export interface AgentLearningProfile {
  agentPersona: string;
  snapshots: WeeklySnapshot[];
  improvementSlope: number;
  trend: 'improving' | 'stable' | 'declining';
  stagnationWeeks: number;
  peakQualityScore: number;
  currentQualityScore: number;
  recommendation: string;
}

export interface LearningCurveReport {
  projectId: string;
  generatedAt: string;
  windowWeeks: number;
  agents: AgentLearningProfile[];
}

export async function getAgentLearningCurves(projectId: string): Promise<LearningCurveReport> {
  const response = await fetch(`/api/agent-learning-curves/${projectId}`);
  if (!response.ok) throw new Error('Failed to fetch agent learning curves');
  return response.json();
}

export interface AgentAutonomyMetrics {
  personaId: string;
  autonomyScore: number;
  selfCompletionRate: number;
  redirectionRate: number;
  escalationCount: number;
  avgHandoffsPerTicket: number;
  autonomyLevel: 'high' | 'medium' | 'low' | 'dependent';
}

export interface AgentAutonomyReport {
  agentMetrics: AgentAutonomyMetrics[];
  summary: {
    avgAutonomyScore: number;
    mostAutonomous: string;
    mostDependent: string;
    highAutonomyCount: number;
  };
  aiSummary?: string;
  recommendations?: string[];
}

export function useAgentAutonomy(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentAutonomyReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentAutonomyReport>(`/projects/${projectId}/agent-autonomy`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentReworkMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  reworkedTasks: number;
  reworkRate: number;
  avgReworkCycles: number;
  commonReworkReasons: string[];
  reworkSourceBreakdown: {
    fromReview: number;
    fromQA: number;
    fromAcceptance: number;
  };
  reworkTier: 'clean' | 'acceptable' | 'concerning' | 'problematic';
}

export interface AgentReworkRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgReworkRate: number;
    cleanAgents: number;
    problematicAgents: string[];
  };
  agents: AgentReworkMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentReworkRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentReworkRateReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentReworkRateReport>(`/projects/${projectId}/agent-rework-rate`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface ChainTicket {
  ticketId: string;
  title: string;
  chainDepth: number;
  agentSequence: string[];
}

export interface AgentChainStats {
  personaId: string;
  passAlongRate: number;
  avgChainDepthInvolved: number;
  totalHandoffsReceived: number;
  totalHandoffsGiven: number;
}

export interface HandoffChainReport {
  deepChainTickets: ChainTicket[];
  agentStats: AgentChainStats[];
  summary: {
    avgChainDepth: number;
    maxChainDepth: number;
    totalTicketsAnalyzed: number;
    mostCommonChainPath: string;
  };
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentHandoffChainDepth(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HandoffChainReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<HandoffChainReport>(`/projects/${projectId}/agent-handoff-chain-depth`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentDecisionSpeedMetrics {
  personaId: string;
  avgHandoffLatencyMs: number;
  avgSessionDurationMs: number;
  avgTurnaroundMs: number;
  decisionVelocity: number;
  stallRate: number;
  speedTier: 'fast' | 'moderate' | 'slow' | 'stalled';
}

export interface DecisionSpeedReport {
  agents: AgentDecisionSpeedMetrics[];
  systemAvgLatencyMs: number;
  fastestAgent: string | null;
  slowestAgent: string | null;
  systemStallRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentDecisionSpeed(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionSpeedReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<DecisionSpeedReport>(`/projects/${projectId}/agent-decision-speed`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentInterruptionMetrics {
  personaId: string; totalInterruptions: number; interruptionRate: number;
  avgCycleTimeWithInterruption: number; avgCycleTimeWithoutInterruption: number;
  cycleTimeOverheadPct: number; recoveryScore: number;
  resilienceLevel: 'high' | 'medium' | 'low' | 'fragile';
}
export interface InterruptionImpactReport {
  agents: AgentInterruptionMetrics[];
  systemAvgInterruptionRate: number; mostResilient: string | null; mostFragile: string | null;
  aiSummary: string; aiRecommendations: string[];
}
export function useAgentInterruptionImpact(projectId: string) {
  const [result, setResult] = useState<InterruptionImpactReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyze = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<InterruptionImpactReport>(`/projects/${projectId}/agent-interruption-impact`, { method: 'POST' });
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };
  return { result, loading, error, analyze };
}

export interface AgentScopeMetrics {
  personaId: string;
  adherenceScore: number;
  overEngineeringPct: number;
  underDeliveryPct: number;
  reworkPct: number;
  avgNotesPerTicket: number;
  adherenceLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ScopeAdherenceReport {
  agents: AgentScopeMetrics[];
  summary: {
    avgAdherenceScore: number;
    mostAdherent: string | null;
    leastAdherent: string | null;
    systemReworkRate: number;
  };
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentScopeAdherence(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScopeAdherenceReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<ScopeAdherenceReport>(`/projects/${projectId}/agent-scope-adherence`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface BlockerBreakdown {
  waitingForInfo: number;
  dependencyBlocked: number;
  reviewBlocked: number;
  clarificationNeeded: number;
  other: number;
}

export interface AgentBlockerMetrics {
  personaId: string;
  totalBlockerEvents: number;
  avgBlockerDuration: number;
  blockerFrequencyScore: number;
  blockerBreakdown: BlockerBreakdown;
  blockerSeverityTier: 'minimal' | 'manageable' | 'significant' | 'critical';
}

export interface BlockerFrequencyReport {
  agents: AgentBlockerMetrics[];
  systemAvgBlockerRate: number;
  mostBlockedAgent: string | null;
  leastBlockedAgent: string | null;
  totalBlockerEvents: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentBlockerFrequency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BlockerFrequencyReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<BlockerFrequencyReport>(`/projects/${projectId}/agent-blocker-frequency`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentTokenBudgetMetrics {
  personaId: string;
  sessionCount: number;
  handoffsInitiated: number;
  ticketsCompleted: number;
  ticketNoteAvgLength: number;
  handoffNoteAvgLength: number;
  estimatedTokens: number;
  tokensPerTicket: number;
  efficiencyScore: number;
  efficiencyTier: 'optimal' | 'efficient' | 'moderate' | 'expensive';
}

export interface AgentTokenBudgetReport {
  agents: AgentTokenBudgetMetrics[];
  totalEstimatedTokens: number;
  avgTokensPerTicket: number;
  mostEfficientAgent: string | null;
  leastEfficientAgent: string | null;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentTokenBudget(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTokenBudgetReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentTokenBudgetReport>(`/projects/${projectId}/agent-token-budget`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentSpecializationDriftMetrics {
  personaId: string;
  primarySpecialization: string;
  totalTicketsHandled: number;
  inSpecializationCount: number;
  outOfSpecializationCount: number;
  specializationAlignmentPct: number;
  driftScore: number;
  driftLevel: 'aligned' | 'minor_drift' | 'significant_drift' | 'off_track';
  taskTypeBreakdown: Record<string, number>;
}

export interface SpecializationDriftReport {
  agents: AgentSpecializationDriftMetrics[];
  systemAvgAlignmentPct: number;
  mostAlignedAgent: string | null;
  mostDriftedAgent: string | null;
  systemTotalTickets: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSpecializationDrift(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpecializationDriftReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<SpecializationDriftReport>(`/projects/${projectId}/agent-specialization-drift`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface ConcurrencyBucket {
  concurrencyLevel: number;
  ticketCount: number;
  avgCompletionMs: number;
  reworkRate: number;
  handoffSuccessRate: number;
}

export interface AgentMultitaskingProfile {
  personaId: string;
  avgConcurrency: number;
  peakConcurrency: number;
  optimalConcurrency: number;
  efficiencyScore: number;
  concurrencyBuckets: ConcurrencyBucket[];
  overloadedPct: number;
  efficiencyTier: 'optimal' | 'acceptable' | 'degraded' | 'overloaded';
}

export interface MultitaskingEfficiencyReport {
  agents: AgentMultitaskingProfile[];
  systemAvgConcurrency: number;
  mostEfficientAgent: string;
  mostOverloadedAgent: string;
  recommendedMaxConcurrency: number;
  aiSummary?: string;
  recommendations?: string[];
}

export const useAgentMultitaskingEfficiency = (projectId: string) =>
  useMutation({
    mutationFn: (): Promise<MultitaskingEfficiencyReport> =>
      fetch(`/api/projects/${projectId}/agent-multitasking-efficiency`, { method: 'POST' }).then(r => r.json()),
  });

// Spec-compliant type aliases
export interface AgentMultitaskingMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  concurrentTaskSessions: number;
  avgConcurrentTasks: number;
  peakConcurrentTasks: number;
  singleTaskCompletionRate: number;
  multiTaskCompletionRate: number;
  efficiencyDropRate: number;
  multitaskingScore: number;
  multitaskingTier: 'efficient' | 'capable' | 'strained' | 'overwhelmed';
}

export interface AgentMultitaskingReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgMultitaskingScore: number;
    mostEfficientAgent: string;
    mostOverloadedAgent: string;
    concurrentCapableAgents: number;
  };
  agents: AgentMultitaskingMetrics[];
  insights: string[];
  recommendations: string[];
}

export interface CollaborationEdge {
  sourcePersonaId: string;
  targetPersonaId: string;
  handoffCount: number;
  successfulHandoffs: number;
  successRate: number;
  avgContextLength: number;
  collaborationStrength: number;
}

export interface AgentNetworkProfile {
  personaId: string;
  totalHandoffs: number;
  outgoingHandoffs: number;
  incomingHandoffs: number;
  uniqueCollaborators: number;
  avgCollaborationStrength: number;
  centralityScore: number;
  role: 'hub' | 'bridge' | 'contributor' | 'isolated';
}

export interface AgentCollaborationGraphReport {
  edges: CollaborationEdge[];
  agents: AgentNetworkProfile[];
  mostActiveCollaborators: string[];
  strongestPair: { source: string; target: string; strength: number };
  mostIsolatedAgent: string;
  networkDensity: number;
  aiSummary?: string;
  recommendations?: string[];
}

export const useAgentCollaborationGraph = (projectId: string) =>
  useMutation({ mutationFn: (): Promise<AgentCollaborationGraphReport> =>
    fetch(`/api/projects/${projectId}/agent-collaboration-graph`, { method: 'POST' }).then(r => r.json()) });

export interface AgentPersonaAlignmentMetrics {
  personaId: string;
  alignmentScore: number;
  primaryTaskRate: number;
  crossPersonaHandoffRate: number;
  roleViolationCount: number;
  specializationIndex: number;
  alignmentLevel: 'exemplary' | 'aligned' | 'drifting' | 'misaligned';
}

export interface PersonaAlignmentReport {
  agents: AgentPersonaAlignmentMetrics[];
  avgAlignmentScore: number;
  mostAligned: string | null;
  mostDrifted: string | null;
  systemCrossPersonaRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentPersonaAlignment(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonaAlignmentReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<PersonaAlignmentReport>(`/projects/${projectId}/agent-persona-alignment`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentFreshnessProfile {
  personaId: string;
  avgHandoffAgeHours: number;
  staleHandoffCount: number;
  freshHandoffCount: number;
  avgTicketUpdateLagHours: number;
  freshnessScore: number;
  freshnessCategory: 'excellent' | 'good' | 'fair' | 'stale';
}

export interface KnowledgeFreshnessReport {
  agents: AgentFreshnessProfile[];
  avgFreshnessScore: number;
  freshestAgent: string;
  staleestAgent: string;
  systemStaleHandoffRate: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentKnowledgeFreshness(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KnowledgeFreshnessReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<KnowledgeFreshnessReport>(`/projects/${projectId}/agent-knowledge-freshness`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentLatencyData {
  personaId: string;
  totalSessions: number;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  sessionsUnder5min: number;
  sessionsOver30min: number;
  fastCompletionRate: number;
  stallRate: number;
  latencyTier: 'fast' | 'moderate' | 'slow' | 'stalled';
}

export interface AgentResponseLatencyReport {
  projectId: string;
  agents: AgentLatencyData[];
  fastestAgent: string | null;
  slowestAgent: string | null;
  avgProjectLatencyMinutes: number;
  stallRiskCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentResponseLatency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResponseLatencyReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentResponseLatencyReport>(`/projects/${projectId}/agent-response-latency`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentErrorRecoveryData {
  personaId: string;
  totalErrors: number;
  recoveredErrors: number;
  errorRecoveryRate: number;
  recoveryRate: number;
  avgRecoveryTimeHours: number;
  avgErrorsPerSession: number;
  consecutiveFailures: number;
  failedHandoffs: number;
  retryAttempts: number;
  resilienceScore: number;
  resilienceTier: 'resilient' | 'recovering' | 'fragile' | 'critical';
}

export interface AgentErrorRecoveryReport {
  projectId: string;
  agents: AgentErrorRecoveryData[];
  mostResilientAgent: string | null;
  mostFragileAgent: string | null;
  avgProjectResilienceScore: number;
  criticalAgentCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentErrorRecovery(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentErrorRecoveryReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentErrorRecoveryReport>(`/projects/${projectId}/agent-error-recovery`, {
        method: 'POST',
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentConfidenceCalibration {
  personaId: string;
  totalAssessments: number;
  calibrationScore: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  avgConfidenceLevel: number;
  avgOutcomeSuccessRate: number;
  calibrationGap: number;
  calibrationLevel: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentConfidenceCalibrationReport {
  agents: AgentConfidenceCalibration[];
  avgCalibrationScore: number;
  bestCalibratedAgent: string | null;
  mostOverconfidentAgent: string | null;
  mostUnderconfidentAgent: string | null;
  systemCalibrationGap: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAnalyzeAgentConfidenceCalibration() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentConfidenceCalibrationReport | null>(null);

  async function analyze(projectId: string): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentConfidenceCalibrationReport>(
        `/projects/${projectId}/agent-confidence-calibration`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

export interface AgentFeedbackIncorporationData {
  personaId: string;
  totalFeedbackReceived: number;
  feedbackIncorporated: number;
  incorporationRate: number;
  repeatFeedbackCount: number;
  avgIterationsToApproval: number;
  fastIncorporationCount: number;
  incorporationScore: number;
  incorporationTier: 'excellent' | 'good' | 'improving' | 'struggling';
}

export interface AgentFeedbackIncorporationReport {
  projectId: string;
  agents: AgentFeedbackIncorporationData[];
  bestIncorporator: string | null;
  mostStrugglingAgent: string | null;
  avgProjectIncorporationRate: number;
  agentsWithRepeatFeedback: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentFeedbackIncorporation(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentFeedbackIncorporationReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentFeedbackIncorporationReport>(
        `/projects/${projectId}/agent-feedback-incorporation`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-091: Agent Throughput Rate
export interface AgentThroughputData {
  personaId: string;
  totalSessions: number;
  ticketsClosed: number;
  ticketsPerSession: number;
  ticketsPerDay: number;
  peakDay: string | null;
  throughputTier: 'high' | 'moderate' | 'low' | 'idle';
}

export interface AgentThroughputRateReport {
  projectId: string;
  agents: AgentThroughputData[];
  highestThroughputAgent: string | null;
  idleAgents: number;
  avgTicketsPerDay: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentThroughputRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentThroughputRateReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentThroughputRateReport>(
        `/projects/${projectId}/agent-throughput-rate`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-092: Agent Success Rate
export interface AgentSuccessRateData {
  personaId: string;
  reliabilityTier: 'reliable' | 'adequate' | 'concerning' | 'critical';
  successRate: number;
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  abandonedSessions: number;
  avgDurationMinutes: number;
}

export interface AgentSuccessRateReport {
  projectId: string;
  agents: AgentSuccessRateData[];
  projectSuccessRate: number;
  mostReliableAgent: string | null;
  mostFragileAgent: string | null;
  criticalAgentsCount: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSuccessRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSuccessRateReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentSuccessRateReport>(
        `/projects/${projectId}/agent-success-rate`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}


// FEAT-094: Agent Cost Efficiency
export interface AgentCostEfficiencyMetrics {
  personaId: string;
  tokenBudgetUsed: number;
  totalSessions: number;
  completedSessions: number;
  avgTokensPerSession: number;
  costEfficiencyScore: number;
  efficiencyTier: 'optimal' | 'efficient' | 'moderate' | 'wasteful';
}

export interface AgentCostEfficiencyReport {
  projectId: string;
  agentMetrics: AgentCostEfficiencyMetrics[];
  totalTokensUsed: number;
  avgCostEfficiencyScore: number;
  mostEfficientAgent: string | null;
  leastEfficientAgent: string | null;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentCostEfficiency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCostEfficiencyReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentCostEfficiencyReport>(
        `/projects/${projectId}/agent-cost-efficiency`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-098: Agent Deadline Adherence
export interface AgentDeadlineData {
  personaId: string;
  totalTasksWithDeadline: number;
  onTimeCount: number;
  lateCount: number;
  missedCount: number;
  avgDelayMinutes: number;
  maxDelayMinutes: number;
  adherenceRate: number;
  slaBreachRate: number;
  adherenceLevel: 'excellent' | 'good' | 'fair' | 'poor';
  delayTrend: 'improving' | 'stable' | 'degrading';
}

export interface AgentDeadlineAdherenceReport {
  projectId: string;
  generatedAt: string;
  agents: AgentDeadlineData[];
  systemAdherenceRate: number;
  mostReliableAgent: string;
  leastReliableAgent: string;
  avgSystemDelay: number;
  totalSlsBreaches: number;
  summary: string;
  recommendations: string[];
}

export function useAgentDeadlineAdherence(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDeadlineAdherenceReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentDeadlineAdherenceReport>(
        `/projects/${projectId}/agent-deadline-adherence`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-099: Agent Session Duration
export interface AgentDurationData {
  personaId: string;
  totalSessions: number;
  avgDurationMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  completedSessions: number;
  microSessionCount: number;
  longSessionCount: number;
  outputPerMinute: number;
  durationScore: number;
  durationTier: 'efficient' | 'optimal' | 'extended' | 'excessive';
}

export interface AgentSessionDurationReport {
  projectId: string;
  agents: AgentDurationData[];
  mostEfficientAgent: string | null;
  longestRunningAgent: string | null;
  shortestRunningAgent: string | null;
  avgProjectSessionMinutes: number;
  totalProjectSessionMinutes: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSessionDuration(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSessionDurationReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentSessionDurationReport>(
        `/projects/${projectId}/agent-session-duration`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-100: Agent Retry Pattern
export interface AgentRetryMetrics {
  personaId: string;
  totalSessions: number;
  totalRetries: number;
  avgRetriesPerSession: number;
  zeroRetryRate: number;
  retrySuccessRate: number;
  maxRetriesInSession: number;
  retryScore: number;
  retryTier: 'efficient' | 'moderate' | 'frequent' | 'chronic';
}

export interface AgentRetryPatternReport {
  agents: AgentRetryMetrics[];
  avgRetriesPerSession: number;
  mostEfficientAgent: string | null;
  highestRetryAgent: string | null;
  totalRetriesAcrossAllAgents: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentRetryPattern(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentRetryPatternReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentRetryPatternReport>(
        `/projects/${projectId}/agent-retry-pattern`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-101: Agent Tool Usage Pattern
export interface AgentToolUsageMetrics {
  personaId: string;
  totalToolCalls: number;
  uniqueToolsUsed: number;
  mostUsedTool: string;
  toolDiversity: number;
  avgToolCallsPerSession: number;
  repeatedToolPattern: boolean;
  usagePattern: 'diverse' | 'focused' | 'minimal' | 'none';
}

export interface AgentToolUsagePatternReport {
  projectId: number;
  generatedAt: string;
  agents: AgentToolUsageMetrics[];
  systemTotalToolCalls: number;
  mostUsedToolSystem: string;
  avgDiversityScore: number;
  diverseAgents: number;
  focusedAgents: number;
  aiSummary: string;
  recommendations: string[];
}

export function useAgentToolUsagePattern(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentToolUsagePatternReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentToolUsagePatternReport>(
        `/projects/${projectId}/agent-tool-usage-pattern`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-103: Agent Priority Adherence
export interface AgentPriorityAdherenceMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  highPriorityTasks: number;
  mediumPriorityTasks: number;
  lowPriorityTasks: number;
  priorityInversions: number;
  correctPrioritySequences: number;
  adherenceRate: number;
  avgEscalationResponseTime: number;
  adherenceScore: number;
  adherenceTier: 'disciplined' | 'consistent' | 'drifting' | 'chaotic';
}

export interface AgentPriorityAdherenceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTasks: number;
    overallAdherenceRate: number;
    mostDisciplined: string;
    mostChaotic: string;
    disciplinedAgents: number;
  };
  agents: AgentPriorityAdherenceMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentPriorityAdherence(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentPriorityAdherenceReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentPriorityAdherenceReport>(
        `/projects/${projectId}/agent-priority-adherence`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

export interface AgentCognitiveLoadMetrics {
  personaId: string;
  totalSessions: number;
  avgConcurrentTasks: number;
  contextSwitches: number;
  avgTokenBudget: number;
  complexTaskRatio: number;
  cognitiveLoadScore: number;
  loadTier: 'critical' | 'high' | 'moderate' | 'low';
}

export interface AgentCognitiveLoadReport {
  projectId: string;
  agents: AgentCognitiveLoadMetrics[];
  mostOverloadedAgent: string | null;
  leastLoadedAgent: string | null;
  avgCognitiveLoadScore: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentCognitiveLoad(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentCognitiveLoadReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentCognitiveLoadReport>(
        `/projects/${projectId}/agent-cognitive-load`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

export interface AgentParallelTaskMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  parallelTasks: number;
  maxConcurrentTasks: number;
  avgConcurrentTasks: number;
  contextSwitches: number;
  parallelCompletionRate: number;
  avgParallelDuration: number;
  efficiencyScore: number;
  efficiencyTier: 'expert' | 'capable' | 'struggling' | 'overwhelmed';
}

export interface AgentParallelTaskReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTasks: number;
    totalParallelTasks: number;
    overallParallelRate: number;
    mostEfficientAgent: string | null;
    expertAgents: number;
  };
  agents: AgentParallelTaskMetrics[];
  insights: string[];
  recommendations: string[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentParallelTaskEfficiency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentParallelTaskReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentParallelTaskReport>(
        `/projects/${projectId}/agent-parallel-task-efficiency`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-102: Agent Goal Completion Analyzer
export interface AgentGoalCompletionMetrics {
  agentId: string;
  agentName: string;
  totalGoals: number;
  fullyCompleted: number;
  partiallyCompleted: number;
  failed: number;
  completionRate: number;
  partialRate: number;
  avgGoalsPerSession: number;
  completionScore: number;
  completionTier: 'exceptional' | 'solid' | 'partial' | 'struggling';
}

export interface AgentGoalCompletionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalGoals: number;
    overallCompletionRate: number;
    topPerformer: string;
    mostStruggling: string;
    exceptionalAgents: number;
  };
  agents: AgentGoalCompletionMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentGoalCompletion(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentGoalCompletionReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentGoalCompletionReport>(
        `/projects/${projectId}/agent-goal-completion`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-105: Agent Communication Pattern Analyzer
export interface AgentCommunicationMetrics {
  agentId: string;
  agentName: string;
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;
  uniquePartners: number;
  avgChainDepth: number;
  maxChainDepth: number;
  avgResponseLatencyMs: number;
  bottleneckScore: number;
  communicationRole: 'hub' | 'relay' | 'leaf' | 'isolated';
}

export interface AgentCommunicationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalMessages: number;
    avgChainDepth: number;
    maxChainDepth: number;
    topBottleneck: string | null;
    hubAgents: number;
  };
  agents: AgentCommunicationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentCommunicationPatterns(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCommunicationReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentCommunicationReport>(
        `/projects/${projectId}/agent-communication-patterns`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-106: Agent Decision Quality Analyzer (new spec)
export interface AgentDecisionQualityMetrics {
  agentId: string;
  agentName: string;
  totalDecisions: number;
  correctnessRate: number;
  revisionRate: number;
  impactScore: number;
  qualityScore: number;
  qualityTier: 'excellent' | 'good' | 'improving' | 'struggling';
}

export interface AgentDecisionQualityReportV2 {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalDecisions: number;
    topDecisionMaker: string | null;
    avgCorrectnessRate: number;
    highQualityAgents: number;
  };
  agents: AgentDecisionQualityMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentDecisionQualityV2(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDecisionQualityReportV2 | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentDecisionQualityReportV2>(
        `/projects/${projectId}/agent-decision-quality-v2`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-107: Agent Self-Correction Rate Analyzer
export interface AgentSelfCorrectionMetrics {
  agentId: string;
  agentName: string;
  totalRevisions: number;
  selfDetectedErrors: number;
  externallyDetectedErrors: number;
  correctionRate: number;
  correctionScore: number;
  correctionTier: 'excellent' | 'good' | 'improving' | 'struggling';
}

export interface AgentSelfCorrectionReport {
  projectId: string;
  generatedAt: string;
  agents: AgentSelfCorrectionMetrics[];
  projectAvgCorrectionRate: number;
  topSelfCorrector: string | null;
  mostErrorProne: string | null;
  totalCorrections: number;
}

export function useAgentSelfCorrectionRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSelfCorrectionReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentSelfCorrectionReport>(
        `/projects/${projectId}/agent-self-correction-rate`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-109: Agent Dependency Resolution Analyzer
export interface AgentDependencyResolutionMetrics {
  agentId: string;
  agentName: string;
  totalDependencies: number;
  resolvedDependencies: number;
  avgResolutionTime: number;
  dependencyResolutionRate: number;
  resolutionScore: number;
  resolutionTier: 'expert' | 'proficient' | 'developing' | 'struggling';
}

export interface AgentDependencyResolutionReport {
  projectId: string;
  agents: AgentDependencyResolutionMetrics[];
  totalDependencies: number;
  resolvedDependencies: number;
  dependencyResolutionRate: number;
  avgResolutionTimeHours: number;
  blockedTickets: number;
  circularDependencies: number;
  longestBlockChain: number;
  aiSummary: string;
  aiRecommendations: string[];
  blockedTicketDetails?: { ticketId: string; ticketTitle: string; blockedBy: string[]; waitTimeHours: number; riskLevel: string }[];
  circularDependencyChains?: { chain: string[]; detectedAt: string }[];
}

export function useAgentDependencyResolution(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDependencyResolutionReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentDependencyResolutionReport>(
        `/projects/${projectId}/agent-dependency-resolution`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-096: Agent Learning Velocity Analyzer
export interface AgentLearningMetrics {
  personaId: string;
  totalSessions: number;
  earlySuccessRate: number;
  recentSuccessRate: number;
  velocityScore: number;
  improvementDelta: number;
  trend: 'improving' | 'stable' | 'regressing';
  sessionsToFirstSuccess: number | null;
  learningPhase: 'novice' | 'learning' | 'proficient' | 'expert';
}

export interface AgentLearningVelocityReport {
  agents: AgentLearningMetrics[];
  avgVelocityScore: number;
  fastestLearner: string | null;
  slowestLearner: string | null;
  mostRegressing: string | null;
  systemImprovementDelta: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentLearningVelocity(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentLearningVelocityReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentLearningVelocityReport>(
        `/projects/${projectId}/agent-learning-velocity`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-111: Agent Context Window Utilization
export interface AgentContextWindowMetrics {
  agentId: string;
  agentName: string;
  avgWindowUsage: number;
  peakUsage: number;
  windowOverflows: number;
  contextEfficiencyScore: number;
  utilizationTier: 'optimal' | 'efficient' | 'cramped' | 'overloaded';
}

export interface AgentContextWindowReport {
  projectId: string;
  agents: AgentContextWindowMetrics[];
  avgWindowUsage: number;
  totalOverflows: number;
  optimalAgents: number;
  overloadedAgents: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentContextWindow(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentContextWindowReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentContextWindowReport>(
        `/projects/${projectId}/agent-context-window-utilization`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-113: Agent Output Consistency Analyzer
export interface AgentOutputConsistencyMetrics {
  agentId: string;
  agentName: string;
  taskGroupsAnalyzed: number;
  avgOutputLength: number;
  outputLengthVariance: number;
  formatConsistencyRate: number;
  completionPhraseConsistency: number;
  consistencyScore: number;
  consistencyTier: 'stable' | 'mostly-stable' | 'variable' | 'erratic';
}

export interface AgentOutputConsistencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTaskGroups: number;
    avgConsistencyScore: number;
    mostConsistentAgent: string;
    highVarianceAgents: number;
  };
  agents: AgentOutputConsistencyMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentOutputConsistency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentOutputConsistencyReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentOutputConsistencyReport>(
        `/projects/${projectId}/agent-output-consistency`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-142: Agent Idle Time Analyzer
export interface AgentIdleTimeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalIdleTime: number;
  avgIdleGap: number;
  longestIdleStreak: number;
  responseLatency: number;
  idleScore: number;
  idleTier: 'highly-active' | 'active' | 'periodic' | 'dormant';
}

export interface AgentIdleTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgProjectIdleGap: number;
    mostActive: string;
    highlyActiveCount: number;
  };
  agents: AgentIdleTimeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentIdleTimeAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentIdleTimeReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentIdleTimeReport>(
        `/projects/${projectId}/agent-idle-time-analyzer`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, data, setData };
}

// FEAT-143: Agent Response Time Efficiency
export interface AgentResponseTimeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasksReceived: number;
  avgResponseTime: number;
  fastResponseRate: number;
  queueDepth: number;
  timeToFirstAction: number;
  responseScore: number;
  responseTier: 'lightning' | 'responsive' | 'moderate' | 'sluggish';
}

export interface AgentResponseTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgResponseScore: number;
    fastestAgent: string;
    lightningCount: number;
  };
  agents: AgentResponseTimeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentResponseTimeEfficiency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentResponseTimeReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentResponseTimeReport>(
        `/projects/${projectId}/agent-response-time-efficiency`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, data, setData };
}

// FEAT-144: Agent Error Recovery Rate
export interface AgentErrorRecoveryMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalErrors: number;
  retrySuccessRate: number;
  avgRecoveryTime: number;
  failureCascadeDepth: number;
  firstAttemptSuccessRate: number;
  recoveryScore: number;
  recoveryTier: 'resilient' | 'recovering' | 'struggling' | 'critical';
}

export interface AgentErrorRecoveryRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgRecoveryScore: number;
    fastestRecoverer: string;
    resilientCount: number;
  };
  agents: AgentErrorRecoveryMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentErrorRecoveryRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentErrorRecoveryRateReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentErrorRecoveryRateReport>(
        `/projects/${projectId}/agent-error-recovery-rate`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, data, setData };
}

// FEAT-116: Agent Collaboration Efficiency Analyzer
export interface AgentCollaborationMetrics {
  agentId: string;
  agentName: string;
  handoffsSent: number;
  handoffsReceived: number;
  continuationRate: number;
  contextUtilizationRate: number;
  collaborationScore: number;
  collaborationTier: 'synergistic' | 'cooperative' | 'independent' | 'isolated';
}

export interface AgentCollaborationEfficiencyReport {
  projectId: string;
  generatedAt: string;
  totalHandoffs: number;
  avgCollaborationScore: number;
  topCollaborator: string;
  collaborationNetworkDensity: number;
  agentMetrics: AgentCollaborationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentCollaborationEfficiency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCollaborationEfficiencyReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentCollaborationEfficiencyReport>(
        `/projects/${projectId}/agent-collaboration-efficiency`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-117: Agent Adaptation Speed Analyzer
export interface AgentAdaptationMetrics {
  agentId: string;
  agentName: string;
  totalHandoffs: number;
  feedbackIncorporationRate: number;
  avgIterationsToSuccess: number;
  requirementChangeCount: number;
  adaptationScore: number;
  adaptationTier: 'rapid' | 'responsive' | 'gradual' | 'resistant';
}

export interface AgentAdaptationSpeedReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAdaptationScore: number;
    fastestAdapter: string;
    slowestAdapter: string;
    rapidAdapters: number;
  };
  agents: AgentAdaptationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentAdaptationSpeed(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentAdaptationSpeedReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentAdaptationSpeedReport>(
        `/projects/${projectId}/agent-adaptation-speed`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-118: Agent Scope Drift Detector
export interface AgentScopeDriftMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  outOfScopeTaskCount: number;
  scopeAdherenceRate: number;
  driftIncidents: number;
  avgDriftSeverity: 'minimal' | 'moderate' | 'significant' | 'critical';
  adherenceScore: number;
  adherenceTier: 'focused' | 'contained' | 'expanding' | 'unconstrained';
}

export interface AgentScopeDriftReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAdherenceScore: number;
    mostFocused: string;
    mostDrifting: string;
    focusedAgents: number;
  };
  agents: AgentScopeDriftMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentScopeDrift(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentScopeDriftReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentScopeDriftReport>(
        `/projects/${projectId}/agent-scope-drift`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-119: Agent Instruction Compliance Analyzer
export interface AgentInstructionComplianceMetrics {
  agentId: string;
  agentName: string;
  totalInstructions: number;
  followedInstructions: number;
  complianceRate: number;
  violationCount: number;
  avgViolationSeverity: 'minor' | 'moderate' | 'major' | 'critical';
  complianceScore: number;
  complianceTier: 'exemplary' | 'compliant' | 'partial' | 'defiant';
}

export interface AgentInstructionComplianceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgComplianceScore: number;
    mostCompliant: string;
    leastCompliant: string;
    exemplaryAgents: number;
  };
  agents: AgentInstructionComplianceMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentInstructionCompliance(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentInstructionComplianceReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentInstructionComplianceReport>(
        `/projects/${projectId}/agent-instruction-compliance`,
        { method: 'POST' },
      );
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, setResult };
}

// FEAT-114: Agent Knowledge Gap Analyzer
export interface DomainGap {
  domain: string;
  tasksAttempted: number;
  successRate: number;
  avgRetriesPerTask: number;
  escalationRate: number;
  knowledgeScore: number;
  gapSeverity: 'none' | 'minor' | 'moderate' | 'critical';
}

export interface AgentKnowledgeGapMetrics {
  agentId: string;
  agentName: string;
  totalTasksAnalyzed: number;
  avgDomainScore: number;
  proficiencyTier: 'specialist' | 'generalist' | 'developing' | 'struggling';
  domains: DomainGap[];
}

export interface AgentKnowledgeGapReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalDomains: number;
    criticalGapCount: number;
    mostStruggling: string;
    mostCoveredDomain: string;
  };
  agents: AgentKnowledgeGapMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentKnowledgeGap(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentKnowledgeGapReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentKnowledgeGapReport>(
        `/projects/${projectId}/agent-knowledge-gap`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-120: Agent Escalation Pattern Analyzer
export interface AgentEscalationPatternMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  escalatedTasks: number;
  escalationRate: number;
  unnecessaryEscalations: number;
  avgResolutionTime: number;
  escalationScore: number;
  escalationTier: 'autonomous' | 'measured' | 'dependent' | 'over-reliant';
}

export interface AgentEscalationPatternAnalyzerReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgEscalationScore: number;
    mostAutonomous: string;
    overReliantAgents: number;
    avgEscalationRate: number;
  };
  agents: AgentEscalationPatternMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentEscalationPatternAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentEscalationPatternAnalyzerReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentEscalationPatternAnalyzerReport>(
        `/projects/${projectId}/agent-escalation-patterns`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-121: Agent Feedback Integration Rate Analyzer
export interface AgentFeedbackData {
  agentId: string;
  agentName: string;
  feedbackReceived: number;
  feedbackActedOn: number;
  integrationRate: number;
  responsivenessTier: 'proactive' | 'responsive' | 'selective' | 'resistant';
  avgResponseTimeHours: number;
  integrationScore: number;
}

export interface AgentFeedbackIntegrationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalFeedbackItems: number;
    avgIntegrationRate: number;
    topResponsiveAgent: string | null;
    leastResponsiveAgent: string | null;
    proactiveAgentCount: number;
  };
  agents: AgentFeedbackData[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentFeedbackIntegration(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentFeedbackIntegrationReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentFeedbackIntegrationReport>(
        `/projects/${projectId}/agent-feedback-integration`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-122: Agent Proactivity Analyzer
export interface AgentProactivityMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  unpromptedNoteCount: number;
  blockerFlagCount: number;
  suggestionCount: number;
  earlyWarningCount: number;
  proactivityScore: number;
  proactivityTier: 'proactive' | 'engaged' | 'reactive' | 'passive';
}

export interface AgentProactivityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgProactivityScore: number;
    mostProactive: string | null;
    leastProactive: string | null;
    proactiveAgents: number;
  };
  agents: AgentProactivityMetrics[];
  insights: string[];
  recommendations: string[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

export function useAgentProactivity(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentProactivityReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentProactivityReport>(
        `/projects/${projectId}/agent-proactivity`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-123: Agent Decision Latency Analyzer
export interface AgentDecisionLatencyMetrics {
  agentId: string;
  agentName: string;
  totalTasksAnalyzed: number;
  avgDecisionLatency: number;
  minLatency: number;
  maxLatency: number;
  latencyScore: number;
  latencyTier: 'swift' | 'prompt' | 'deliberate' | 'sluggish';
}

export interface AgentDecisionLatencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgDecisionLatency: number;
    fastestAgent: string | null;
    slowestAgent: string | null;
    swiftAgentCount: number;
  };
  agents: AgentDecisionLatencyMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentDecisionLatency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentDecisionLatencyReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentDecisionLatencyReport>(
        `/projects/${projectId}/agent-decision-latency`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-125: Agent Resource Consumption Analyzer
export interface AgentResourceMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  totalTokensUsed: number;
  totalApiCalls: number;
  avgTokensPerTask: number;
  avgApiCallsPerTask: number;
  avgSessionDurationMs: number;
  consumptionScore: number;
  consumptionTier: 'efficient' | 'normal' | 'heavy' | 'excessive';
}

export interface AgentResourceConsumptionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTokensUsed: number;
    avgTokensPerAgent: number;
    avgApiCallsPerTask: number;
    mostEfficient: string;
    mostExpensive: string;
  };
  agents: AgentResourceMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentResourceConsumption(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentResourceConsumptionReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentResourceConsumptionReport>(
        `/projects/${projectId}/agent-resource-consumption`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-126: Agent Session Quality Scorer
export interface AgentSessionQualityMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  avgSessionScore: number;
  outputCompleteness: number;
  handoffRate: number;
  avgSessionDurationMinutes: number;
  qualityTier: 'excellent' | 'good' | 'adequate' | 'poor';
}

export interface AgentSessionQualityReport {
  projectId: string;
  agents: AgentSessionQualityMetrics[];
  avgQualityScore: number;
  highQualityAgents: number;
  topAgent: string | null;
  sessionQualityCategories: { excellent: number; good: number; adequate: number; poor: number };
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSessionQuality(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentSessionQualityReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentSessionQualityReport>(
        `/projects/${projectId}/agent-session-quality`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-128: Agent Workflow State Transition Analyzer
export interface AgentWorkflowTransitionMetrics {
  agentId: string;
  agentName: string;
  totalTransitions: number;
  avgTransitionTimeHours: number;
  fastestTransitionHours: number;
  slowestTransitionHours: number;
  stalledTickets: number;
  transitionEfficiencyScore: number;
  efficiencyTier: 'fluid' | 'steady' | 'sluggish' | 'blocked';
}

export interface WorkflowStateStats {
  state: string;
  avgDurationHours: number;
  ticketCount: number;
  stalledCount: number;
}

export interface AgentWorkflowTransitionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTransitions: number;
    avgTransitionTimeHours: number;
    fastestAgent: string | null;
    stalledTotal: number;
    fluidAgents: number;
  };
  agents: AgentWorkflowTransitionMetrics[];
  stateStats: WorkflowStateStats[];
  insights: string[];
  recommendations: string[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

export function useAgentWorkflowTransitions(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentWorkflowTransitionReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentWorkflowTransitionReport>(
        `/projects/${projectId}/agent-workflow-transitions`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, data, setData };
}

// FEAT-129: Agent Knowledge Transfer Efficiency Analyzer
export interface AgentKnowledgeTransferMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  sessionsWithHandoffNotes: number;
  knowledgeTransferRate: number;
  avgHandoffNoteLength: number;
  receivedKnowledgeCount: number;
  knowledgeRetentionScore: number;
  transferEfficiencyTier: 'excellent' | 'good' | 'adequate' | 'poor';
}

export interface AgentKnowledgeTransferReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgKnowledgeTransferRate: number;
    topTransferAgent: string;
    lowestTransferAgent: string;
    knowledgeLossRiskCount: number;
  };
  agents: AgentKnowledgeTransferMetrics[];
  insights: string[];
  recommendations: string[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

export function useAgentKnowledgeTransfer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentKnowledgeTransferReport | null>(null);

  async function analyze(): Promise<void> {
    setLoading(true);
    try {
      const r = await apiFetch<AgentKnowledgeTransferReport>(
        `/projects/${projectId}/agent-knowledge-transfer`,
        { method: 'POST' },
      );
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-131: Agent Delegation Depth Analyzer
export interface AgentDelegationMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  delegatedSessions: number;
  directResolutions: number;
  delegationRate: number;
  avgHandoffDepth: number;
  maxHandoffDepth: number;
  delegationScore: number;
  delegationTier: 'balanced' | 'over-delegator' | 'under-delegator' | 'isolated';
}

export interface AgentDelegationDepthReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgDelegationRate: number;
    maxChainDepth: number;
    balancedAgents: number;
    overDelegators: string[];
  };
  agents: AgentDelegationMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentDelegationDepth(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentDelegationDepthReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentDelegationDepthReport>(
        `/projects/${projectId}/agent-delegation-depth`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-132: Agent Autonomy Index
export interface AgentAutonomyMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  directCompletions: number;
  escalatedSessions: number;
  autonomyRate: number;
  avgHandoffsPerSession: number;
  autonomyScore: number;
  autonomyTier: 'highly_autonomous' | 'autonomous' | 'semi_autonomous' | 'dependent';
}

export interface AgentAutonomyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAutonomyScore: number;
    highlyAutonomousAgents: number;
    dependentAgents: number;
    mostAutonomousAgent: string | null;
  };
  agents: AgentAutonomyMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentAutonomyIndex(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentAutonomyReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentAutonomyReport>(
        `/projects/${projectId}/agent-autonomy-index`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-133: Agent Blocked Time Analyzer
export interface AgentBlockedTimeMetrics {
  agentId: string;
  agentName: string;
  totalActiveTasks: number;
  totalBlockedTasks: number;
  blockedTimeRate: number;
  avgBlockDurationHours: number;
  longestBlockHours: number;
  topBlockerType: string;
  unblockedScore: number;
  unblockedTier: 'unblocked' | 'occasionally-blocked' | 'frequently-blocked' | 'perpetually-blocked';
}

export interface AgentBlockedTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgBlockedTimeRate: number;
    mostBlockedAgent: string;
    leastBlockedAgent: string;
    criticalBlockCount: number;
  };
  agents: AgentBlockedTimeMetrics[];
  insights: string[];
  recommendations: string[];
}

export function useAgentBlockedTime(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentBlockedTimeReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentBlockedTimeReport>(
        `/projects/${projectId}/agent-blocked-time`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-136: Agent Quality-Speed Tradeoff Analyzer
export interface AgentQualitySpeedData {
  agentId: string;
  agentName: string;
  tasksCompleted: number;
  avgCompletionTimeHours: number;
  avgQualityScore: number;
  reviewPassRate: number;
  firstPassRate: number;
  revisionCount: number;
  tradeoffScore: number;
  tradeoffTier: 'optimized' | 'balanced' | 'quality-focused' | 'speed-focused' | 'struggling';
}

export interface AgentQualitySpeedReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgTradeoffScore: number;
    mostOptimizedAgent: string;
    mostStrugglingAgent: string;
    optimizedAgentCount: number;
  };
  agents: AgentQualitySpeedData[];
  insights: string[];
  recommendations: string[];
}

export function useAgentQualitySpeed(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentQualitySpeedReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentQualitySpeedReport>(
        `/projects/${projectId}/agent-quality-speed`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-137: Agent Specialization Score Analyzer
export interface AgentSpecializationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasks: number;
  inDomainTasks: number;
  outOfDomainTasks: number;
  inDomainRate: number;
  specializationScore: number;
  topInDomainCategory: string;
  topOutOfDomainCategory: string;
  specializationTier: 'highly-specialized' | 'focused' | 'generalist' | 'unfocused';
}

export interface AgentSpecializationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgSpecializationScore: number;
    mostSpecializedAgent: string;
    mostUnfocusedAgent: string;
    highlySpecializedCount: number;
  };
  agents: AgentSpecializationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSpecialization(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentSpecializationReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentSpecializationReport>(
        `/projects/${projectId}/agent-specialization`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-139: AI Agent Collaboration Score Analyzer
export interface AgentCollaborationScoreMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalCollaborations: number;
  successfulCollaborations: number;
  collaborationSuccessRate: number;
  avgContextQuality: number;
  avgHandoffCompleteness: number;
  collaborationScore: number;
  collaborationTier: 'synergistic' | 'collaborative' | 'functional' | 'isolated';
  topCollaborator: string | null;
}

export interface AgentCollaborationScoreReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgCollaborationScore: number;
    mostCollaborativeAgent: string;
    synergisticCount: number;
  };
  agents: AgentCollaborationScoreMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentCollaborationScore(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentCollaborationScoreReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentCollaborationScoreReport>(
        `/projects/${projectId}/agent-collaboration-score`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-140: AI Agent Throughput Analyzer
export interface AgentThroughputMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasksCompleted: number;
  avgDailyThroughput: number;
  peakDailyThroughput: number;
  peakPeriod: string;
  throughputScore: number;
  throughputTier: 'high-velocity' | 'steady' | 'moderate' | 'low-output';
  throughputTrend: 'improving' | 'stable' | 'declining';
}

export interface AgentThroughputReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgProjectThroughput: number;
    topPerformer: string;
    highVelocityCount: number;
  };
  agents: AgentThroughputMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentThroughput(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentThroughputReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentThroughputReport>(
        `/projects/${projectId}/agent-throughput`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, isPending: loading, data, setData };
}

// FEAT-145: Agent Workload Balance Analyzer
export interface AgentWorkloadMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTasksAssigned: number;
  avgTasksPerSession: number;
  peakWorkloadSession: number;
  workloadVariance: number;
  utilizationRate: number;
  workloadScore: number;
  workloadTier: 'balanced' | 'overloaded' | 'underutilized' | 'idle';
}

export interface AgentWorkloadReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgWorkloadScore: number;
    mostLoaded: string;
    balancedCount: number;
  };
  agents: AgentWorkloadMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentWorkloadBalance(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentWorkloadReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentWorkloadReport>(
        `/projects/${projectId}/agent-workload-balance`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, data, setData };
}

// FEAT-146: Agent Deadline Adherence Analyzer
export interface AgentDeadlineMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalDeadlines: number;
  metOnTime: number;
  avgDelayHours: number;
  adherenceScore: number;
  adherenceTier: 'excellent' | 'good' | 'at-risk' | 'failing';
}

export interface AgentDeadlineAdherenceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAdherenceScore: number;
    excellentCount: number;
    criticalDelays: number;
  };
  agents: AgentDeadlineMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentDeadlineAdherenceAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentDeadlineAdherenceReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await apiFetch<AgentDeadlineAdherenceReport>(
        `/projects/${projectId}/agent-deadline-adherence-analyzer`,
        { method: 'POST' },
      );
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, data, setData };
}

// FEAT-147: Agent Token Cost Efficiency
export interface AgentTokenCostReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalEstimatedCost: number;
    avgEfficiencyScore: number;
  };
  agents: Array<{
    agentId: string;
    agentName: string;
    agentRole: string;
    totalSessions: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalTokens: number;
    estimatedCostUsd: number;
    ticketsCompleted: number;
    costPerTicket: number;
    tokensPerTicket: number;
    efficiencyScore: number;
    efficiencyTier: string;
  }>;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentTokenCostEfficiency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTokenCostReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentTokenCostReport>(
        `/projects/${projectId}/agent-token-cost-efficiency`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

// FEAT-148: Agent Skill Coverage Analyzer
export interface AgentSkillCoverageReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgCoverageScore: number;
    fullCoverageCount: number;
    specializationCount: number;
    ticketCategoriesTotal: number;
  };
  agents: Array<{
    agentId: string;
    agentName: string;
    agentRole: string;
    totalTickets: number;
    priorityCoverage: {
      urgent: number;
      high: number;
      medium: number;
      low: number;
    };
    complexityCoverage: {
      simple: number;
      standard: number;
      complex: number;
    };
    coverageScore: number;
    coverageTier: string;
    dominantPriority: string;
    dominantComplexity: string;
  }>;
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSkillCoverage(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSkillCoverageReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentSkillCoverageReport>(
        `/projects/${projectId}/agent-skill-coverage`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentLearningMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  earlyCompletionRate: number;
  recentCompletionRate: number;
  completionRateDelta: number;
  earlyAvgDurationMs: number;
  recentAvgDurationMs: number;
  durationDeltaMs: number;
  learningScore: number;
  learningTier: 'accelerating' | 'improving' | 'stable' | 'declining';
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}

export interface AgentLearningCurveReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgLearningScore: number;
    improvingCount: number;
    decliningCount: number;
    stableCount: number;
  };
  agents: AgentLearningMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentLearningCurveAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentLearningCurveReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentLearningCurveReport>(
        `/projects/${projectId}/agent-learning-curve-analyzer`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentCollaborationNetworkMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  handoffsSent: number;
  handoffsReceived: number;
  totalHandoffs: number;
  uniqueCollaborators: number;
  collaborationScore: number;
  collaborationTier: 'hub' | 'collaborative' | 'contributing' | 'isolated';
  isHub: boolean;
  isIsolated: boolean;
}

export interface AgentCollaborationNetworkReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalHandoffs: number;
    avgCollaborationScore: number;
    hubCount: number;
    isolatedCount: number;
    topHandoffPair: { fromAgent: string; toAgent: string; count: number } | null;
  };
  agents: AgentCollaborationNetworkMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentCollaborationNetworkAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCollaborationNetworkReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentCollaborationNetworkReport>(
        `/projects/${projectId}/agent-collaboration-network-analyzer`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface WindowStats {
  window: 'morning' | 'afternoon' | 'evening' | 'night';
  sessionCount: number;
  completionRate: number;
  avgSpeedScore: number;
  score: number;
}

export interface AgentPeakMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  windows: WindowStats[];
  peakWindow: 'morning' | 'afternoon' | 'evening' | 'night' | 'insufficient_data';
  peakScore: number;
  consistency: number;
}

export interface AgentPeakPerformanceReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    agentsWithPeak: number;
    mostCommonPeakWindow: string;
    avgPeakScore: number;
  };
  agents: AgentPeakMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentPeakPerformance(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentPeakPerformanceReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentPeakPerformanceReport>(
        `/projects/${projectId}/agent-peak-performance`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentSwitchMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  switchCount: number;
  switchRate: number;
  sameCategoryAvgMs: number;
  switchCategoryAvgMs: number;
  switchCostMs: number;
  switchCostPct: number;
  tier: 'high_cost' | 'moderate_cost' | 'low_cost' | 'flexible' | 'insufficient_data';
}

export interface AgentContextSwitchCostReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgSwitchCost: number;
    highCostCount: number;
    lowCostCount: number;
    flexibleCount: number;
  };
  agents: AgentSwitchMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentContextSwitchCost(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentContextSwitchCostReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentContextSwitchCostReport>(
        `/projects/${projectId}/agent-context-switch-cost`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentBurnoutMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  analysisWindowDays: number;
  sessionsPerDay: number;
  maxConsecutiveDays: number;
  avgRestIntervalHours: number;
  longestSessionMs: number;
  burnoutScore: number;
  riskTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface BurnoutRiskReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highRiskCount: number;
    moderateRiskCount: number;
    lowRiskCount: number;
    avgSessionsPerDay: number;
  };
  agents: AgentBurnoutMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentBurnoutRisk(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BurnoutRiskReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<BurnoutRiskReport>(
        `/projects/${projectId}/agent-burnout-risk`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentHandoffMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  completedSessions: number;
  stalledSessions: number;
  successRate: number;
  avgCompletionMs: number;
  reliabilityTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface HandoffSuccessRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highSuccessCount: number;
    lowSuccessCount: number;
    avgSuccessRate: number;
    totalHandoffs: number;
  };
  agents: AgentHandoffMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentHandoffSuccessRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HandoffSuccessRateReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<HandoffSuccessRateReport>(
        `/projects/${projectId}/agent-handoff-success-rate`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentVelocityMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalCompletedSessions: number;
  analysisWindowWeeks: number;
  avgSessionsPerWeek: number;
  recentWeekSessions: number;
  allTimeWeeklyPeak: number;
  velocityTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  velocityScore: number;
  velocityTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface TaskCompletionVelocityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highVelocityCount: number;
    decliningCount: number;
    avgTicketsPerWeek: number;
    totalCompletedSessions: number;
  };
  agents: AgentVelocityMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentTaskCompletionVelocity(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskCompletionVelocityReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<TaskCompletionVelocityReport>(
        `/projects/${projectId}/agent-task-completion-velocity`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentInterruptionMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  interruptedSessions: number;
  interruptionsPerSession: number;
  avgInterruptedSessionMs: number;
  focusRatio: number;
  interruptionScore: number;
  interruptionTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface InterruptionFrequencyReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highInterruptionCount: number;
    lowInterruptionCount: number;
    avgInterruptionsPerSession: number;
    totalInterruptions: number;
  };
  agents: AgentInterruptionMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentInterruptionFrequency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterruptionFrequencyReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<InterruptionFrequencyReport>(
        `/projects/${projectId}/agent-interruption-frequency`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentSessionDurationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  avgDurationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  durationScore: number;
  durationTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface SessionDurationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    efficientCount: number;
    slowCount: number;
    avgDurationMs: number;
    totalSessions: number;
  };
  agents: AgentSessionDurationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentSessionDurationAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SessionDurationReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<SessionDurationReport>(
        `/projects/${projectId}/agent-session-duration-analyzer`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentFailurePatternMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  failedSessions: number;
  timedOutSessions: number;
  failureRate: number;
  timeoutRate: number;
  maxConsecutiveFailures: number;
  lastFailedAt: Date | string | null;
  healthScore: number;
  healthTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface FailurePatternReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    criticalCount: number;
    healthyCount: number;
    avgFailureRate: number;
    totalFailedSessions: number;
  };
  agents: AgentFailurePatternMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentFailurePatterns(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FailurePatternReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<FailurePatternReport>(
        `/projects/${projectId}/agent-failure-patterns`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentQueueDepthMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  queuedTickets: number;
  inProgressTickets: number;
  totalActiveTickets: number;
  avgTicketAgeHours: number;
  oldestTicketAgeHours: number;
  queueScore: number;
  queueTier: 'overloaded' | 'busy' | 'normal' | 'idle';
}

export interface QueueDepthReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    overloadedCount: number;
    idleCount: number;
    avgQueueDepth: number;
    totalQueuedTickets: number;
  };
  agents: AgentQueueDepthMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentQueueDepthAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueueDepthReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<QueueDepthReport>(
        `/projects/${projectId}/agent-queue-depth-analyzer`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentRetryRateMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTicketsAttempted: number;
  retriedTickets: number;
  totalSessions: number;
  retryRate: number;
  avgSessionsPerTicket: number;
  maxSessionsOnOneTicket: number;
  efficiencyScore: number;
  efficiencyTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface RetryRateReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highRetryCount: number;
    efficientCount: number;
    avgRetryRate: number;
    totalRetriedTickets: number;
  };
  agents: AgentRetryRateMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentRetryRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetryRateReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<RetryRateReport>(
        `/projects/${projectId}/agent-retry-rate`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentAvailabilityMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  totalActiveHours: number;
  avgSessionGapHours: number;
  longestIdleHours: number;
  availabilityRate: number;
  availabilityScore: number;
  availabilityTier: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

export interface AvailabilityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highAvailabilityCount: number;
    lowAvailabilityCount: number;
    avgAvailabilityRate: number;
    totalActiveHours: number;
  };
  agents: AgentAvailabilityMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function useAgentAvailability(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AvailabilityReport | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<AvailabilityReport>(
        `/projects/${projectId}/agent-availability`,
        { method: 'POST' },
      );
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loading, result, setResult };
}

export interface AgentSpecializationIndexMetrics {
  agentId: string; agentName: string; agentRole: string; totalTickets: number;
  uniqueEpics: number; uniqueStatuses: number; dominantEpicId: string | null;
  dominantEpicTickets: number; dominantEpicRatio: number; specializationScore: number; specializationTier: string;
}
export interface SpecializationIndexReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; specialistCount: number; generalistCount: number; avgSpecializationScore: number; avgEpicsPerAgent: number; };
  agents: AgentSpecializationIndexMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentSpecializationIndex(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpecializationIndexReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<SpecializationIndexReport>(`/projects/${projectId}/agent-specialization-index`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentResponseLagMetrics {
  agentId: string; agentName: string; agentRole: string; totalTicketsAnalyzed: number;
  avgLagHours: number; medianLagHours: number; maxLagHours: number; minLagHours: number;
  slowTickets: number; lagScore: number; lagTier: string;
}
export interface ResponseLagReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; slowCount: number; fastCount: number; avgLagHours: number; totalTicketsAnalyzed: number; };
  agents: AgentResponseLagMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentResponseLag(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResponseLagReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<ResponseLagReport>(`/projects/${projectId}/agent-response-lag`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentCapacityUtilizationMetrics {
  agentId: string; agentName: string; agentRole: string; totalSessions: number;
  totalSessionHours: number; avgSessionHours: number; observationWindowHours: number;
  utilizationRate: number; utilizationScore: number; utilizationTier: string;
}
export interface CapacityUtilizationReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; overloadedCount: number; underutilizedCount: number; avgUtilizationRate: number; totalSessionHours: number; };
  agents: AgentCapacityUtilizationMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentCapacityUtilization(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CapacityUtilizationReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<CapacityUtilizationReport>(`/projects/${projectId}/agent-capacity-utilization`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentThroughputVariabilityMetrics {
  agentId: string; agentName: string; agentRole: string; totalTicketsAnalyzed: number;
  weeklyThroughputs: number[]; avgWeeklyThroughput: number; stdDevWeeklyThroughput: number;
  coefficientOfVariation: number; variabilityScore: number; variabilityTier: string;
}
export interface ThroughputVariabilityReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; highVariabilityCount: number; stableCount: number; avgCoefficientOfVariation: number; totalTicketsAnalyzed: number; };
  agents: AgentThroughputVariabilityMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentThroughputVariability(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThroughputVariabilityReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<ThroughputVariabilityReport>(`/projects/${projectId}/agent-throughput-variability`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentCostPerOutcomeMetrics {
  agentId: string; agentName: string; agentRole: string; completedTickets: number;
  totalTokensUsed: number; costPerOutcome: number; costScore: number; costTier: string;
}
export interface CostPerOutcomeReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; efficientCount: number; inefficientCount: number; avgCostPerOutcome: number; totalTokensAnalyzed: number; };
  agents: AgentCostPerOutcomeMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentCostPerOutcome(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CostPerOutcomeReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<CostPerOutcomeReport>(`/projects/${projectId}/agent-cost-per-outcome`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentWorkloadSaturationMetrics {
  agentId: string; agentName: string; agentRole: string; activeTickets: number;
  completedTickets: number; inProgressTickets: number; reviewTickets: number;
  avgTicketsPerDay: number; peakConcurrentTickets: number; saturationRate: number;
  saturationScore: number; saturationTier: string;
}
export interface WorkloadSaturationReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; overloadedCount: number; saturatedCount: number; healthyCount: number; underutilizedCount: number; avgSaturationRate: number; totalActiveTickets: number; };
  agents: AgentWorkloadSaturationMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentWorkloadSaturation(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorkloadSaturationReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<WorkloadSaturationReport>(`/projects/${projectId}/agent-workload-saturation`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentRecoveryTimeMetrics {
  agentId: string; agentName: string; agentRole: string; totalTickets: number;
  blockedTickets: number; completedAfterBlock: number; avgRecoveryTimeHours: number;
  minRecoveryTimeHours: number; maxRecoveryTimeHours: number; recoverySuccessRate: number;
  recoveryScore: number; recoveryTier: string;
}
export interface RecoveryTimeReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; fastRecoveryCount: number; slowRecoveryCount: number; chronicIssuesCount: number; avgRecoveryTimeHours: number; totalBlockedIncidents: number; };
  agents: AgentRecoveryTimeMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentRecoveryTime(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecoveryTimeReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<RecoveryTimeReport>(`/projects/${projectId}/agent-recovery-time`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentEscalationRateMetrics {
  agentId: string; agentName: string; agentRole: string; totalTickets: number;
  escalatedTickets: number; selfResolvedTickets: number; handoffCount: number;
  avgEscalationsPerTicket: number; escalationRate: number; escalationScore: number; escalationTier: string;
}
export interface EscalationRateReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; highEscalationCount: number; lowEscalationCount: number; autonomousCount: number; avgEscalationRate: number; totalEscalations: number; };
  agents: AgentEscalationRateMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentEscalationRate(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EscalationRateReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<EscalationRateReport>(`/projects/${projectId}/agent-escalation-rate`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface CategoryPerformance {
  category: string; ticketCount: number; completedCount: number; blockedCount: number;
  escalatedCount: number; avgResolutionDays: number; completionRate: number; performanceVsAvg: number;
}
export interface AgentKnowledgeGapMetrics {
  agentId: string; agentName: string; agentRole: string; totalTickets: number;
  categoryBreakdown: CategoryPerformance[]; gapCount: number; proficientCount: number;
  avgCompletionRate: number; overallGapScore: number; gapTier: string;
}
export interface KnowledgeGapReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; criticalGapsCount: number; minorGapsCount: number; proficientCount: number; avgGapScore: number; totalGapsDetected: number; };
  agents: AgentKnowledgeGapMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentKnowledgeGapAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KnowledgeGapReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<KnowledgeGapReport>(`/projects/${projectId}/agent-knowledge-gap-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentIdleTimeTrackerMetrics {
  agentId: string; agentName: string; agentRole: string; totalActiveTimeMs: number;
  totalIdleTimeMs: number; totalTrackedTimeMs: number; idleTimeRatio: number;
  avgIdlePeriodMs: number; longestIdlePeriodMs: number; idleScore: number; idleTier: string;
}
export interface IdleTimeTrackerReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; highIdleCount: number; lowIdleCount: number; optimalCount: number; avgIdleTimeMs: number; totalIdleTimeMs: number; };
  agents: AgentIdleTimeTrackerMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentIdleTimeTracker(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IdleTimeTrackerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<IdleTimeTrackerReport>(`/projects/${projectId}/agent-idle-time-tracker`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentParallelTaskTrackerMetrics {
  agentId: string; agentName: string; agentRole: string; totalTickets: number;
  avgConcurrentTasks: number; maxConcurrentTasks: number; soloCompletionRate: number;
  parallelCompletionRate: number; velocityDegradationRatio: number; optimalConcurrency: number;
  parallelEfficiencyScore: number; efficiencyTier: string;
}
export interface ParallelTaskEfficiencyTrackerReport {
  projectId: string; generatedAt: string;
  summary: { totalAgents: number; highEfficiencyCount: number; lowEfficiencyCount: number; optimalParallelism: number; avgConcurrentTasks: number; avgEfficiencyScore: number; };
  agents: AgentParallelTaskTrackerMetrics[]; aiSummary: string; aiRecommendations: string[];
}
export function useAgentParallelTaskEfficiencyTracker(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParallelTaskEfficiencyTrackerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<ParallelTaskEfficiencyTrackerReport>(`/projects/${projectId}/agent-parallel-task-efficiency-tracker`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentContextRetentionAnalyzerMetric {
  agentId: string; agentName: string; retentionScore: number; contextReuseEvents: number;
  contextMissEvents: number; avgContextAgeSeconds: number;
  trend: 'improving' | 'stable' | 'degrading'; riskLevel: 'low' | 'medium' | 'high';
}
export interface AgentContextRetentionAnalyzerReport {
  metrics: AgentContextRetentionAnalyzerMetric[]; fleetAvgRetentionScore: number;
  poorRetentionAgents: number; analysisTimestamp: string;
}
export function useAgentContextRetentionAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentContextRetentionAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentContextRetentionAnalyzerReport>(`/projects/${projectId}/agent-context-retention-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentGoalDriftMetric {
  agentId: string; agentName: string; driftScore: number; onTaskRatio: number;
  driftEvents: number; avgDriftDurationSeconds: number;
  trend: 'improving' | 'stable' | 'worsening'; severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface AgentGoalDriftReport {
  metrics: AgentGoalDriftMetric[]; fleetAvgDriftScore: number;
  highDriftAgents: number; analysisTimestamp: string;
}
export function useAgentGoalDriftAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentGoalDriftReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentGoalDriftReport>(`/projects/${projectId}/agent-goal-drift-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentDecisionLatencyAnalyzerMetric {
  agentId: string; agentName: string; avgDecisionLatencyMs: number; p50LatencyMs: number;
  p95LatencyMs: number; slowDecisions: number; fastDecisions: number;
  trend: 'improving' | 'stable' | 'worsening'; rating: 'fast' | 'acceptable' | 'slow' | 'critical';
}
export interface AgentDecisionLatencyAnalyzerReport {
  metrics: AgentDecisionLatencyAnalyzerMetric[]; fleetAvgLatencyMs: number;
  slowAgents: number; analysisTimestamp: string;
}
export function useAgentDecisionLatencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDecisionLatencyAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentDecisionLatencyAnalyzerReport>(`/projects/${projectId}/agent-decision-latency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentOutputQualityConsistencyMetric {
  agentId: string; agentName: string; consistencyScore: number; avgQualityScore: number;
  qualityVariance: number; highQualityRuns: number; lowQualityRuns: number;
  trend: 'improving' | 'stable' | 'worsening'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentOutputQualityConsistencyReport {
  metrics: AgentOutputQualityConsistencyMetric[]; fleetAvgConsistencyScore: number;
  inconsistentAgents: number; analysisTimestamp: string;
}
export function useAgentOutputQualityConsistency(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentOutputQualityConsistencyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentOutputQualityConsistencyReport>(`/projects/${projectId}/agent-output-quality-consistency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentCollaborationEfficiencyAnalyzerMetric {
  agentId: string; agentName: string; collaborationScore: number; handoffSuccessRate: number; coordinationOverhead: number; sharedContextReuseRate: number; collaborationEvents: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentCollaborationEfficiencyAnalyzerReport {
  metrics: AgentCollaborationEfficiencyAnalyzerMetric[]; fleetAvgCollaborationScore: number; poorCollaborators: number; analysisTimestamp: string;
}
export function useAgentCollaborationEfficiencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCollaborationEfficiencyAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentCollaborationEfficiencyAnalyzerReport>(`/projects/${projectId}/agent-collaboration-efficiency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentInstructionAdherenceMetric {
  agentId: string; agentName: string; adherenceScore: number; violationCount: number; constraintBreachRate: number; partialAdherenceRate: number; fullAdherenceRate: number; trend: 'improving' | 'stable' | 'degrading'; complianceLevel: 'compliant' | 'marginal' | 'non-compliant' | 'critical';
}
export interface AgentInstructionAdherenceReport {
  metrics: AgentInstructionAdherenceMetric[]; fleetAvgAdherenceScore: number; nonCompliantAgents: number; analysisTimestamp: string;
}
export function useAgentInstructionAdherenceAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentInstructionAdherenceReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentInstructionAdherenceReport>(`/projects/${projectId}/agent-instruction-adherence-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentCommunicationQualityAnalyzerMetric {
  agentId: string; agentName: string; qualityScore: number; clarityScore: number; completenessScore: number; actionabilityScore: number; communicationEvents: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentCommunicationQualityAnalyzerReport {
  metrics: AgentCommunicationQualityAnalyzerMetric[]; fleetAvgQualityScore: number; poorCommunicators: number; analysisTimestamp: string;
}
export function useAgentCommunicationQualityAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCommunicationQualityAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentCommunicationQualityAnalyzerReport>(`/projects/${projectId}/agent-communication-quality-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentAdaptationSpeedAnalyzerMetric {
  agentId: string; agentName: string; adaptationScore: number; contextSwitchLatency: number; recalibrationRate: number; errorRecoverySpeed: number; adaptationEvents: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentAdaptationSpeedAnalyzerReport {
  metrics: AgentAdaptationSpeedAnalyzerMetric[]; fleetAvgAdaptationScore: number; slowAdapters: number; analysisTimestamp: string;
}
export function useAgentAdaptationSpeedAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentAdaptationSpeedAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentAdaptationSpeedAnalyzerReport>(`/projects/${projectId}/agent-adaptation-speed-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentSelfCorrectionRateAnalyzerMetric {
  agentId: string; agentName: string; selfCorrectionRate: number; totalErrors: number; selfCorrected: number; externalCorrections: number; correctionSpeed: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentSelfCorrectionRateAnalyzerReport {
  metrics: AgentSelfCorrectionRateAnalyzerMetric[]; fleetAvgSelfCorrectionRate: number; lowSelfCorrectors: number; analysisTimestamp: string;
}
export function useAgentSelfCorrectionRateAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentSelfCorrectionRateAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentSelfCorrectionRateAnalyzerReport>(`/projects/${projectId}/agent-self-correction-rate-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentConfidenceCalibrationAnalyzerMetric {
  agentId: string; agentName: string; calibrationScore: number; avgConfidenceExpressed: number; avgActualAccuracy: number; calibrationError: number; overconfidentDecisions: number; underconfidentDecisions: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentConfidenceCalibrationAnalyzerReport {
  metrics: AgentConfidenceCalibrationAnalyzerMetric[]; fleetAvgCalibrationScore: number; poorlyCalibrated: number; analysisTimestamp: string;
}
export function useAgentConfidenceCalibrationAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentConfidenceCalibrationAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentConfidenceCalibrationAnalyzerReport>(`/projects/${projectId}/agent-confidence-calibration-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentTaskPrioritizationAccuracyMetric {
  agentId: string; agentName: string; prioritizationScore: number; highPriorityCompletionRate: number; priorityInversionRate: number; urgencyResponseTime: number; totalTasksAnalyzed: number; trend: 'improving' | 'stable' | 'degrading'; accuracy: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentTaskPrioritizationAccuracyReport {
  metrics: AgentTaskPrioritizationAccuracyMetric[]; fleetAvgPrioritizationScore: number; poorPrioritizers: number; analysisTimestamp: string;
}
export function useAgentTaskPrioritizationAccuracyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentTaskPrioritizationAccuracyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentTaskPrioritizationAccuracyReport>(`/projects/${projectId}/agent-task-prioritization-accuracy-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentToolSelectionAccuracyMetric {
  agentId: string; agentName: string; toolSelectionScore: number; optimalToolRate: number; unnecessaryToolCallRate: number; toolMismatchRate: number; totalToolCalls: number; trend: 'improving' | 'stable' | 'degrading'; precision: 'expert' | 'proficient' | 'developing' | 'poor';
}
export interface AgentToolSelectionAccuracyReport {
  metrics: AgentToolSelectionAccuracyMetric[]; fleetAvgToolSelectionScore: number; lowPrecisionAgents: number; analysisTimestamp: string;
}
export function useAgentToolSelectionAccuracyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentToolSelectionAccuracyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentToolSelectionAccuracyReport>(`/projects/${projectId}/agent-tool-selection-accuracy-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentWorkflowCoverageMetric {
  agentId: string; agentName: string; coverageScore: number; autonomousSteps: number; assistedSteps: number; blockedSteps: number; totalWorkflowSteps: number; coverageTrend: 'expanding' | 'stable' | 'shrinking'; coverageLevel: 'full' | 'high' | 'partial' | 'low';
}
export interface AgentWorkflowCoverageReport {
  metrics: AgentWorkflowCoverageMetric[]; fleetAvgCoverageScore: number; lowCoverageAgents: number; fullCoverageAgents: number; analysisTimestamp: string;
}
export function useAgentWorkflowCoverageAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentWorkflowCoverageReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentWorkflowCoverageReport>(`/projects/${projectId}/agent-workflow-coverage-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentDependencyRiskMetric {
  agentId: string; agentName: string; riskScore: number; uniqueDependencies: number; concentrationIndex: number; criticalDependencies: number; crossAgentDependencies: number; riskLevel: 'critical' | 'high' | 'moderate' | 'low'; riskTrend: 'increasing' | 'stable' | 'decreasing';
}
export interface AgentDependencyRiskReport {
  metrics: AgentDependencyRiskMetric[]; fleetAvgRiskScore: number; criticalRiskAgents: number; singlePointsOfFailure: number; analysisTimestamp: string;
}
export function useAgentDependencyRiskAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDependencyRiskReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentDependencyRiskReport>(`/projects/${projectId}/agent-dependency-risk-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentMultiAgentSyncEfficiencyMetric {
  agentId: string; agentName: string; syncEfficiencyScore: number; conflictRate: number; contextSharingLatency: number; stateConsistencyRate: number; coordinationEvents: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentMultiAgentSyncEfficiencyReport {
  metrics: AgentMultiAgentSyncEfficiencyMetric[]; fleetAvgSyncEfficiencyScore: number; highConflictAgents: number; analysisTimestamp: string;
}
export function useAgentMultiAgentSyncEfficiencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentMultiAgentSyncEfficiencyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentMultiAgentSyncEfficiencyReport>(`/projects/${projectId}/agent-multi-agent-sync-efficiency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentOutputAccuracyRateMetric {
  agentId: string; agentName: string; outputAccuracyRate: number; totalOutputs: number; accurateOutputs: number; inaccurateOutputs: number; hallucinationRate: number; reworkRate: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentOutputAccuracyRateReport {
  metrics: AgentOutputAccuracyRateMetric[]; fleetAvgOutputAccuracyRate: number; lowAccuracyAgents: number; analysisTimestamp: string;
}
export function useAgentOutputAccuracyRateAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentOutputAccuracyRateReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentOutputAccuracyRateReport>(`/projects/${projectId}/agent-output-accuracy-rate-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentGoalCompletionRateAnalyzerMetric {
  agentId: string; agentName: string; goalCompletionRate: number; totalGoals: number; completedGoals: number; abandonedGoals: number; partialGoals: number; avgCompletionTime: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentGoalCompletionRateAnalyzerReport {
  metrics: AgentGoalCompletionRateAnalyzerMetric[]; fleetAvgGoalCompletionRate: number; lowCompletionAgents: number; analysisTimestamp: string;
}
export function useAgentGoalCompletionRateAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentGoalCompletionRateAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentGoalCompletionRateAnalyzerReport>(`/projects/${projectId}/agent-goal-completion-rate-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentPromptEfficiencyAnalyzerMetric {
  agentId: string; agentName: string; promptEfficiencyScore: number; avgTokensPerTask: number; avgTasksPerKTokens: number; verbosityRate: number; concisencyRate: number; totalTokensEstimate: number; trend: 'improving' | 'stable' | 'degrading'; rating: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentPromptEfficiencyAnalyzerReport {
  metrics: AgentPromptEfficiencyAnalyzerMetric[]; fleetAvgPromptEfficiencyScore: number; lowEfficiencyAgents: number; analysisTimestamp: string;
}
export function useAgentPromptEfficiencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentPromptEfficiencyAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentPromptEfficiencyAnalyzerReport>(`/projects/${projectId}/agent-prompt-efficiency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentLearningRateMetric {
  agentId: string; agentName: string; learningScore: number; improvementRate: number; repeatErrorRate: number; sessionSuccessProgression: number; totalSessionsAnalyzed: number; trend: 'improving' | 'stable' | 'degrading'; learningLevel: 'rapid' | 'steady' | 'slow' | 'stagnant';
}
export interface AgentLearningRateAnalyzerReport {
  metrics: AgentLearningRateMetric[]; fleetAvgLearningScore: number; stagnantAgents: number; analysisTimestamp: string;
}
export function useAgentLearningRateAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentLearningRateAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentLearningRateAnalyzerReport>(`/projects/${projectId}/agent-learning-rate-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentErrorRecoverySpeedMetric {
  agentId: string; agentName: string; recoveryScore: number; avgRecoveryTimeMs: number; recoverySuccessRate: number; errorRecurrenceRate: number; totalErrorsAnalyzed: number; trend: 'improving' | 'stable' | 'degrading'; resilience: 'resilient' | 'capable' | 'fragile' | 'critical';
}
export interface AgentErrorRecoverySpeedAnalyzerReport {
  metrics: AgentErrorRecoverySpeedMetric[]; fleetAvgRecoveryScore: number; criticalAgents: number; analysisTimestamp: string;
}
export function useAgentErrorRecoverySpeedAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentErrorRecoverySpeedAnalyzerReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentErrorRecoverySpeedAnalyzerReport>(`/projects/${projectId}/agent-error-recovery-speed-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentAutonomyLevelMetric {
  agentId: string; agentName: string; autonomyScore: number; unsupervisedCompletionRate: number; humanOverrideRate: number; escalationRatio: number; selfResolutionRate: number; totalSessionsAnalyzed: number; trend: 'improving' | 'stable' | 'degrading'; autonomyLevel: 'fully-autonomous' | 'semi-autonomous' | 'assisted' | 'dependent';
}
export interface AgentAutonomyLevelReport {
  metrics: AgentAutonomyLevelMetric[]; fleetAvgAutonomyScore: number; dependentAgents: number; fullyAutonomousAgents: number; analysisTimestamp: string;
}
export function useAgentAutonomyLevelAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentAutonomyLevelReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentAutonomyLevelReport>(`/projects/${projectId}/agent-autonomy-level-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentResourceEfficiencyMetric {
  agentId: string; agentName: string; efficiencyScore: number; tokensPerTask: number; redundantCallRate: number; outputToResourceRatio: number; sessionOverheadRate: number; totalSessionsAnalyzed: number; trend: 'improving' | 'stable' | 'degrading'; efficiencyLevel: 'optimal' | 'efficient' | 'moderate' | 'wasteful';
}
export interface AgentResourceEfficiencyReport {
  metrics: AgentResourceEfficiencyMetric[]; fleetAvgEfficiencyScore: number; wastefulAgents: number; optimalAgents: number; analysisTimestamp: string;
}
export function useAgentResourceEfficiencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResourceEfficiencyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentResourceEfficiencyReport>(`/projects/${projectId}/agent-resource-efficiency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentConsistencyMetric {
  agentId: string; agentName: string; totalSessions: number; sessionsWithContradictions: number; sessionsWithContextLoss: number; sessionsWithGoalDrift: number; consistencyScore: number; trend: 'improving' | 'stable' | 'degrading'; consistencyLevel: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface AgentMultiTurnConsistencyReport {
  consistencyScore: number; totalSessions: number; contradictionRate: number; contextLossRate: number; goalDriftRate: number; trend: 'improving' | 'stable' | 'degrading'; mostConsistentAgent: string; leastConsistentAgent: string; agents: AgentConsistencyMetric[]; aiSummary: string; aiRecommendations: string[]; analysisTimestamp: string;
}
export function useAgentMultiTurnConsistencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentMultiTurnConsistencyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentMultiTurnConsistencyReport>(`/projects/${projectId}/agent-multi-turn-consistency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentSensitivityMetric {
  agentId: string; agentName: string; totalResponses: number; highVarianceResponses: number; ambiguityFailures: number; robustResponses: number; sensitivityScore: number; robustnessScore: number; trend: 'improving' | 'stable' | 'degrading'; sensitivityLevel: 'robust' | 'moderate' | 'sensitive' | 'highly_sensitive';
}
export interface AgentPromptSensitivityReport {
  sensitivityScore: number; totalResponses: number; highVarianceRate: number; ambiguityFailureRate: number; robustnessScore: number; trend: 'improving' | 'stable' | 'degrading'; mostRobustAgent: string; mostSensitiveAgent: string; agents: AgentSensitivityMetric[]; aiSummary: string; aiRecommendations: string[]; analysisTimestamp: string;
}
export function useAgentPromptSensitivityAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentPromptSensitivityReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentPromptSensitivityReport>(`/projects/${projectId}/agent-prompt-sensitivity-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentDecisionConfidenceMetric {
  agentId: string; agentName: string; avgConfidenceScore: number; highConfidenceRate: number; lowConfidenceRate: number; overconfidentFailures: number; calibrationScore: number; confidenceTrend: 'rising' | 'stable' | 'declining'; confidenceLevel: 'well-calibrated' | 'overconfident' | 'underconfident' | 'erratic';
}
export interface AgentDecisionConfidenceReport {
  metrics: AgentDecisionConfidenceMetric[]; fleetAvgConfidenceScore: number; overconfidentAgents: number; wellCalibratedAgents: number; analysisTimestamp: string;
}
export function useAgentDecisionConfidenceAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentDecisionConfidenceReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentDecisionConfidenceReport>(`/projects/${projectId}/agent-decision-confidence-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentKnowledgeTransferEfficiencyMetric {
  agentId: string; agentName: string; transferEfficiencyScore: number; handoffsInitiated: number; handoffsReceived: number; knowledgeLossEvents: number; avgContextRetentionRate: number; transferLatency: number; transferTrend: 'improving' | 'stable' | 'degrading'; transferQuality: 'excellent' | 'good' | 'poor' | 'failing';
}
export interface AgentKnowledgeTransferEfficiencyReport {
  metrics: AgentKnowledgeTransferEfficiencyMetric[]; fleetAvgTransferScore: number; highLossAgents: number; excellentTransferAgents: number; analysisTimestamp: string;
}
export function useAgentKnowledgeTransferEfficiencyAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentKnowledgeTransferEfficiencyReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentKnowledgeTransferEfficiencyReport>(`/projects/${projectId}/agent-knowledge-transfer-efficiency-analyzer`, { method: 'POST' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentInstructionComplexityMetric {
  agentId: string; agentName: string; complexityScore: number; avgInstructionLength: number; ambiguityScore: number; conditionalBranchCount: number; multiStepDepth: number; totalSessionsAnalyzed: number; complexityTrend: 'increasing' | 'stable' | 'decreasing'; complexityLevel: 'simple' | 'moderate' | 'complex' | 'critical';
}
export interface AgentInstructionComplexityReport {
  metrics: AgentInstructionComplexityMetric[]; fleetAvgComplexityScore: number; criticalComplexityAgents: number; simpleInstructionAgents: number; topComplexInstructions: string[]; recommendations: string[]; analysisTimestamp: string;
}
export function useAgentInstructionComplexityAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentInstructionComplexityReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentInstructionComplexityReport>(`/projects/${projectId}/agent-instruction-complexity-analyzer`, { method: 'GET' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}

export interface AgentContextWindowUtilizationMetric {
  agentId: string; agentName: string; avgUtilizationPct: number; peakUtilizationPct: number; truncationEvents: number; contextRefreshRate: number; highUtilizationSessions: number; totalSessionsAnalyzed: number; utilizationTrend: 'increasing' | 'stable' | 'decreasing'; utilizationLevel: 'efficient' | 'moderate' | 'high' | 'critical';
}
export interface AgentContextWindowUtilizationReport {
  metrics: AgentContextWindowUtilizationMetric[]; fleetAvgUtilizationPct: number; criticalUtilizationAgents: number; efficientAgents: number; utilizationDistribution: { bucket: string; count: number }[]; criticalSessions: { agentId: string; agentName: string; utilizationPct: number }[]; recommendations: string[]; analysisTimestamp: string;
}
export function useAgentContextWindowUtilizationAnalyzer(projectId: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentContextWindowUtilizationReport | null>(null);
  const analyze = async (): Promise<void> => {
    setLoading(true);
    try { const data = await apiFetch<AgentContextWindowUtilizationReport>(`/projects/${projectId}/agent-context-window-utilization-analyzer`, { method: 'GET' }); setResult(data); }
    finally { setLoading(false); }
  };
  return { analyze, loading, result, setResult };
}
