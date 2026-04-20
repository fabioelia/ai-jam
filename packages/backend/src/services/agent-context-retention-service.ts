import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContextRetentionProfile {
  personaId: string;
  totalSessions: number;
  completedSessions: number;
  avgTokenBudget: number;
  sessionContinuityScore: number;
  tokenBudgetUtilization: number;
  sessionVolumeScore: number;
  contextRichScore: number;
  retentionTier: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentContextRetentionReport {
  agents: AgentContextRetentionProfile[];
  avgContextRichScore: number;
  highestRetentionAgent: string | null;
  continuousAgents: number;
  aiSummary: string;
  aiRecommendations: string[];
}

export const FALLBACK_SUMMARY = 'Context retention analysis complete.';
export const FALLBACK_RECOMMENDATIONS = ['Ensure agents read prior notes before acting.'];

export type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  costTokensIn: number;
  costTokensOut: number;
};

export function retentionCategory(score: number): AgentContextRetentionProfile['retentionTier'] {
  if (score >= 75) return 'excellent';
  if (score >= 55) return 'good';
  if (score >= 35) return 'fair';
  return 'poor';
}

export function computeContextRichScore(
  sessionContinuityScore: number,
  tokenBudgetUtilization: number,
  sessionVolumeScore: number,
): number {
  return sessionContinuityScore * 0.4 + tokenBudgetUtilization * 0.35 + sessionVolumeScore * 0.25;
}

export function buildProfiles(sessions: SessionRow[]): {
  profiles: AgentContextRetentionProfile[];
} {
  // Group sessions by personaType
  const sessionsByAgent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const profiles: AgentContextRetentionProfile[] = [];
  for (const [personaId, agentSessionList] of sessionsByAgent.entries()) {
    const totalSessions = agentSessionList.length;
    const completedSessions = agentSessionList.filter(s => s.status === 'completed').length;
    const totalTokens = agentSessionList.reduce(
      (sum, s) => sum + (s.costTokensIn ?? 0) + (s.costTokensOut ?? 0),
      0,
    );
    const avgTokenBudget = totalSessions > 0 ? totalTokens / totalSessions : 0;

    const sessionContinuityScore = (completedSessions / Math.max(totalSessions, 1)) * 100;
    const tokenBudgetUtilization = Math.min(Math.max(avgTokenBudget / 2000, 0), 1) * 100;
    const sessionVolumeScore = Math.min(completedSessions / 10, 1) * 100;
    const contextRichScore = computeContextRichScore(
      sessionContinuityScore,
      tokenBudgetUtilization,
      sessionVolumeScore,
    );

    profiles.push({
      personaId,
      totalSessions,
      completedSessions,
      avgTokenBudget: Math.round(avgTokenBudget),
      sessionContinuityScore: Math.round(sessionContinuityScore * 10) / 10,
      tokenBudgetUtilization: Math.round(tokenBudgetUtilization * 10) / 10,
      sessionVolumeScore: Math.round(sessionVolumeScore * 10) / 10,
      contextRichScore: Math.round(contextRichScore * 10) / 10,
      retentionTier: retentionCategory(contextRichScore),
    });
  }

  profiles.sort((a, b) => b.contextRichScore - a.contextRichScore);
  return { profiles };
}

export async function analyzeAgentContextRetention(projectId: string): Promise<AgentContextRetentionReport> {
  const projectTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map(t => t.id);
  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    const rawSessions = await db
      .select({
        id: agentSessions.id,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
        costTokensIn: agentSessions.costTokensIn,
        costTokensOut: agentSessions.costTokensOut,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));

    allSessions = rawSessions;
  }

  const { profiles } = buildProfiles(allSessions);

  const avgContextRichScore =
    profiles.length > 0
      ? Math.round(profiles.reduce((s, p) => s + p.contextRichScore, 0) / profiles.length)
      : 0;

  const highestRetentionAgent = profiles.length > 0 ? profiles[0].personaId : null;
  const continuousAgents = profiles.filter(
    p => p.retentionTier === 'excellent' || p.retentionTier === 'good',
  ).length;

  let aiSummary = FALLBACK_SUMMARY;
  let aiRecommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = profiles
      .map(p =>
        `${p.personaId}: contextRichScore=${p.contextRichScore}, tier=${p.retentionTier}, totalSessions=${p.totalSessions}, completedSessions=${p.completedSessions}, avgTokenBudget=${p.avgTokenBudget}`,
      )
      .join('\n');

    const prompt = `Analyze this agent context retention data:\n${summary}\n\nReturn JSON with:\n- summary: one paragraph describing overall context retention health\n- recommendations: array of 2-3 actionable recommendations (for agents scoring below 55)\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Context retention AI analysis failed, using fallback:', e);
  }

  return {
    agents: profiles,
    avgContextRichScore,
    highestRetentionAgent,
    continuousAgents,
    aiSummary,
    aiRecommendations,
  };
}
