import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentFeedbackMetrics {
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
  agents: AgentFeedbackMetrics[];
  avgProjectIncorporationRate: number;
  bestIncorporator: string | null;
  mostStrugglingAgent: string | null;
  agentsWithRepeatFeedback: number;
  aiSummary: string;
  aiRecommendations: string[];
}

// Legacy aliases kept for backward compat
export type AgentFeedbackData = AgentFeedbackMetrics;

export const FALLBACK_SUMMARY = 'Feedback incorporation analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review tickets that cycle through review multiple times.'];

export type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
};

export type SessionRow = {
  ticketId: string | null;
  personaType: string;
  retryCount: number;
  startedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
};

export function computeIncorporationScore(
  incorporationRate: number,
  avgIterationsToApproval: number,
  repeatFeedbackCount: number,
  fastIncorporationCount: number,
  totalFeedbackReceived: number,
): number {
  let score = incorporationRate;
  if (avgIterationsToApproval <= 1) score += 10;
  const repeatPenalty = Math.min(25, Math.max(0, repeatFeedbackCount - 1) * 5);
  score -= repeatPenalty;
  if (totalFeedbackReceived > 0 && fastIncorporationCount / totalFeedbackReceived > 0.5) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeIncorporationTier(score: number): AgentFeedbackData['incorporationTier'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'improving';
  return 'struggling';
}

export function buildFeedbackProfiles(
  ticketRows: TicketRow[],
  sessionRows: SessionRow[],
): AgentFeedbackData[] {
  const agentSet = new Set<string>();
  for (const t of ticketRows) {
    if (t.assignedPersona) agentSet.add(t.assignedPersona);
  }

  const profiles: AgentFeedbackData[] = [];

  for (const personaId of agentSet) {
    const agentTicketIds = new Set(
      ticketRows.filter((t) => t.assignedPersona === personaId).map((t) => t.id),
    );

    const agentSess = sessionRows.filter(
      (s) => s.ticketId && agentTicketIds.has(s.ticketId) && s.personaType === personaId,
    );

    // distinct tickets where retryCount > 0
    const feedbackTicketIds = new Set(
      agentSess.filter((s) => s.retryCount > 0).map((s) => s.ticketId!),
    );
    const totalFeedbackReceived = feedbackTicketIds.size;

    // of those, tickets in qa/acceptance/done
    const feedbackIncorporated = ticketRows.filter(
      (t) =>
        feedbackTicketIds.has(t.id) &&
        (t.status === 'qa' || t.status === 'acceptance' || t.status === 'done'),
    ).length;

    const incorporationRate =
      totalFeedbackReceived > 0 ? (feedbackIncorporated / totalFeedbackReceived) * 100 : 0;

    // distinct tickets where retryCount > 1
    const repeatFeedbackCount = new Set(
      agentSess.filter((s) => s.retryCount > 1).map((s) => s.ticketId!),
    ).size;

    // avg (retryCount+1) for tickets in done/acceptance
    const approvedTickets = ticketRows.filter(
      (t) =>
        agentTicketIds.has(t.id) &&
        (t.status === 'done' || t.status === 'acceptance'),
    );
    let avgIterationsToApproval = 0;
    if (approvedTickets.length > 0) {
      const totalIter = approvedTickets.reduce((sum, t) => {
        const sess = agentSess.filter((s) => s.ticketId === t.id);
        const maxRetry = sess.length > 0 ? Math.max(...sess.map((s) => s.retryCount)) : 0;
        return sum + (maxRetry + 1);
      }, 0);
      avgIterationsToApproval = totalIter / approvedTickets.length;
    }

    // sessions where retryCount>0 AND startedAt-createdAt <= 3600000ms
    const fastIncorporationCount = agentSess.filter(
      (s) =>
        s.retryCount > 0 &&
        s.startedAt !== null &&
        s.startedAt.getTime() - s.createdAt.getTime() <= 3600000,
    ).length;

    const incorporationScore = computeIncorporationScore(
      incorporationRate,
      avgIterationsToApproval,
      repeatFeedbackCount,
      fastIncorporationCount,
      totalFeedbackReceived,
    );

    profiles.push({
      personaId,
      totalFeedbackReceived,
      feedbackIncorporated,
      incorporationRate: Math.round(incorporationRate * 100) / 100,
      repeatFeedbackCount,
      avgIterationsToApproval: Math.round(avgIterationsToApproval * 100) / 100,
      fastIncorporationCount,
      incorporationScore,
      incorporationTier: computeIncorporationTier(incorporationScore),
    });
  }

  profiles.sort((a, b) => b.incorporationScore - a.incorporationScore);
  return profiles;
}

export async function analyzeAgentFeedbackIncorporation(
  projectId: string,
): Promise<AgentFeedbackIncorporationReport> {
  const projectTickets: TicketRow[] = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        retryCount: agentSessions.retryCount,
        startedAt: agentSessions.startedAt,
        createdAt: agentSessions.createdAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildFeedbackProfiles(projectTickets, allSessions);

  const avgProjectIncorporationRate =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.incorporationRate, 0) / agents.length * 100) / 100
      : 0;

  const qualified = agents.filter((a) => a.totalFeedbackReceived >= 2);
  const bestIncorporator = qualified.length > 0 ? qualified[0].personaId : null;
  const mostStrugglingAgent =
    qualified.length > 1 ? qualified[qualified.length - 1].personaId : null;

  const agentsWithRepeatFeedback = agents.filter((a) => a.repeatFeedbackCount > 2).length;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agents
      .map(
        (a) =>
          `${a.personaId}: tier=${a.incorporationTier}, score=${a.incorporationScore}, rate=${a.incorporationRate.toFixed(1)}%`,
      )
      .join('\n');

    const prompt = `Analyze this AI agent feedback incorporation data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall feedback incorporation health\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        aiSummary = raw;
      }
    }
  } catch (e) {
    console.warn('Feedback incorporation AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    bestIncorporator,
    mostStrugglingAgent,
    avgProjectIncorporationRate,
    agentsWithRepeatFeedback,
    aiSummary,
    aiRecommendations,
  };
}
