import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

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

export const FALLBACK_SUMMARY = 'Retry pattern analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Review agents with chronic retry patterns to identify root causes.'];

export function computeRetryScore(
  avgRetriesPerSession: number,
  zeroRetryRate: number,
  maxRetriesInSession: number,
): number {
  let score = 100 - (avgRetriesPerSession * 20) + (zeroRetryRate * 0.2) - (maxRetriesInSession > 5 ? 10 : 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeRetryTier(retryScore: number): AgentRetryMetrics['retryTier'] {
  if (retryScore >= 80) return 'efficient';
  if (retryScore >= 60) return 'moderate';
  if (retryScore >= 40) return 'frequent';
  return 'chronic';
}

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  retryCount: number;
};

export function buildRetryProfiles(sessions: SessionRow[]): AgentRetryMetrics[] {
  const sessionsByAgent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const profiles: AgentRetryMetrics[] = [];

  for (const [personaId, agentSessions] of sessionsByAgent.entries()) {
    const totalSessions = agentSessions.length;
    const totalRetries = agentSessions.reduce((s, sess) => s + sess.retryCount, 0);
    const avgRetriesPerSession = totalSessions > 0 ? totalRetries / totalSessions : 0;
    const zeroRetrySessions = agentSessions.filter((s) => s.retryCount === 0).length;
    const zeroRetryRate = totalSessions > 0 ? (zeroRetrySessions / totalSessions) * 100 : 100;
    const completedWithRetries = agentSessions.filter((s) => s.status === 'completed' && s.retryCount > 0).length;
    const sessionsWithRetries = agentSessions.filter((s) => s.retryCount > 0).length;
    const retrySuccessRate = sessionsWithRetries > 0 ? (completedWithRetries / sessionsWithRetries) * 100 : 0;
    const maxRetriesInSession = totalSessions > 0 ? Math.max(...agentSessions.map((s) => s.retryCount)) : 0;
    const retryScore = computeRetryScore(avgRetriesPerSession, zeroRetryRate, maxRetriesInSession);

    profiles.push({
      personaId,
      totalSessions,
      totalRetries,
      avgRetriesPerSession: Math.round(avgRetriesPerSession * 100) / 100,
      zeroRetryRate: Math.round(zeroRetryRate),
      retrySuccessRate: Math.round(retrySuccessRate),
      maxRetriesInSession,
      retryScore,
      retryTier: computeRetryTier(retryScore),
    });
  }

  profiles.sort((a, b) => b.retryScore - a.retryScore);
  return profiles;
}

export async function analyzeAgentRetryPattern(projectId: string): Promise<AgentRetryPatternReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        retryCount: agentSessions.retryCount,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildRetryProfiles(allSessions);

  const avgRetriesPerSession = agents.length > 0
    ? Math.round((agents.reduce((s, a) => s + a.avgRetriesPerSession, 0) / agents.length) * 100) / 100
    : 0;

  const mostEfficientAgent = agents.length > 0 ? agents[0].personaId : null;
  const highestRetryAgent = agents.length > 1 ? agents[agents.length - 1].personaId : null;
  const totalRetriesAcrossAllAgents = agents.reduce((s, a) => s + a.totalRetries, 0);

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentSummaryText = agents
      .map(
        (a) =>
          `${a.personaId}: tier=${a.retryTier}, score=${a.retryScore}, avgRetries=${a.avgRetriesPerSession}, zeroRetryRate=${a.zeroRetryRate}%`,
      )
      .join('\n');

    const prompt = `Analyze this agent retry pattern data:\n${agentSummaryText}\n\nReturn JSON with:\n- summary: 1-2 sentence insight\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Retry pattern AI analysis failed, using fallback:', e);
  }

  return {
    agents,
    avgRetriesPerSession,
    mostEfficientAgent,
    highestRetryAgent,
    totalRetriesAcrossAllAgents,
    aiSummary,
    aiRecommendations,
  };
}
