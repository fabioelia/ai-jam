import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

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

export const FALLBACK_SUMMARY = 'Session duration analysis complete.';
export const FALLBACK_RECOMMENDATIONS = [
  'Review agents with excessive session durations to identify inefficiencies.',
  'Consider breaking long sessions into smaller focused tasks.',
];

export function computeDurationScore(
  outputPerMinute: number,
  avgDurationMinutes: number,
  microRate: number,
  longRate: number,
): number {
  // Base: outputPerMinute normalized to 0-100 (cap at 1.0 output/min = 100)
  let score = Math.min(100, outputPerMinute * 100);
  // Bonus: +10 if avgDuration between 10-45 (optimal range)
  if (avgDurationMinutes >= 10 && avgDurationMinutes <= 45) score += 10;
  // Penalty: -10 if microRate > 0.5
  if (microRate > 0.5) score -= 10;
  // Penalty: -15 if longRate > 0.3
  if (longRate > 0.3) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeDurationTier(
  durationScore: number,
  avgDurationMinutes: number,
): AgentDurationData['durationTier'] {
  if (avgDurationMinutes > 120 || durationScore < 40) return 'excessive';
  if (avgDurationMinutes > 60 || durationScore < 60) return 'extended';
  if (durationScore >= 80 && avgDurationMinutes <= 30) return 'efficient';
  return 'optimal';
}

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

export function buildDurationProfiles(sessions: SessionRow[]): AgentDurationData[] {
  // Group sessions by personaType
  const sessionsByAgent = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByAgent.get(s.personaType) ?? [];
    list.push(s);
    sessionsByAgent.set(s.personaType, list);
  }

  const profiles: AgentDurationData[] = [];

  for (const [personaId, agentSessions] of sessionsByAgent.entries()) {
    const durations: number[] = [];
    let completedSessions = 0;
    let microSessionCount = 0;
    let longSessionCount = 0;

    for (const s of agentSessions) {
      if (!s.startedAt || !s.completedAt) continue;
      const durationMs = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
      const durationMin = durationMs / 60000;
      if (durationMin < 0) continue;

      durations.push(durationMin);
      if (s.status === 'completed') completedSessions++;
      if (durationMin < 5) microSessionCount++;
      if (durationMin > 60) longSessionCount++;
    }

    const totalSessions = agentSessions.length;
    const totalDurationMinutes = durations.reduce((s, d) => s + d, 0);
    const avgDurationMinutes = durations.length > 0 ? Math.round(totalDurationMinutes / durations.length) : 0;
    const minDurationMinutes = durations.length > 0 ? Math.round(Math.min(...durations)) : 0;
    const maxDurationMinutes = durations.length > 0 ? Math.round(Math.max(...durations)) : 0;
    const outputPerMinute = totalDurationMinutes > 0 ? completedSessions / totalDurationMinutes : 0;
    const microRate = totalSessions > 0 ? microSessionCount / totalSessions : 0;
    const longRate = totalSessions > 0 ? longSessionCount / totalSessions : 0;

    const durationScore = computeDurationScore(outputPerMinute, avgDurationMinutes, microRate, longRate);
    const durationTier = computeDurationTier(durationScore, avgDurationMinutes);

    profiles.push({
      personaId,
      totalSessions,
      avgDurationMinutes,
      minDurationMinutes,
      maxDurationMinutes,
      completedSessions,
      microSessionCount,
      longSessionCount,
      outputPerMinute: Math.round(outputPerMinute * 10000) / 10000,
      durationScore,
      durationTier,
    });
  }

  profiles.sort((a, b) => b.durationScore - a.durationScore);
  return profiles;
}

export async function analyzeAgentSessionDuration(projectId: string): Promise<AgentSessionDurationReport> {
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
        startedAt: agentSessions.startedAt,
        completedAt: agentSessions.completedAt,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  const agents = buildDurationProfiles(allSessions);

  const allDurations = agents.map((a) => a.avgDurationMinutes);
  const totalProjectSessionMinutes = agents.reduce((s, a) => s + a.avgDurationMinutes * a.totalSessions, 0);
  const avgProjectSessionMinutes = agents.length > 0
    ? Math.round(allDurations.reduce((s, d) => s + d, 0) / agents.length)
    : 0;

  // mostEfficientAgent: highest outputPerMinute (min 3 sessions)
  const eligibleForEfficient = agents.filter((a) => a.totalSessions >= 3);
  const mostEfficientAgent = eligibleForEfficient.length > 0
    ? eligibleForEfficient.reduce((best, a) => a.outputPerMinute > best.outputPerMinute ? a : best).personaId
    : null;

  // longestRunningAgent: highest avgDurationMinutes (min 3 sessions)
  const longestRunningAgent = eligibleForEfficient.length > 0
    ? eligibleForEfficient.reduce((best, a) => a.avgDurationMinutes > best.avgDurationMinutes ? a : best).personaId
    : null;

  // shortestRunningAgent: lowest avgDurationMinutes (min 3 sessions)
  const shortestRunningAgent = eligibleForEfficient.length > 0
    ? eligibleForEfficient.reduce((best, a) => a.avgDurationMinutes < best.avgDurationMinutes ? a : best).personaId
    : null;

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
          `${a.personaId}: tier=${a.durationTier}, avgDuration=${a.avgDurationMinutes}m, score=${a.durationScore}, outputPerMin=${a.outputPerMinute.toFixed(4)}`,
      )
      .join('\n');

    const prompt = `Analyze this agent session duration data:\n${agentSummaryText}\n\nReturn JSON with:\n- summary: 1-2 sentence insight\n- recommendations: array of 2-3 actionable recommendations\n\nRespond ONLY with valid JSON.`;

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
    console.warn('Session duration AI analysis failed, using fallback:', e);
  }

  return {
    projectId,
    agents,
    mostEfficientAgent,
    longestRunningAgent,
    shortestRunningAgent,
    avgProjectSessionMinutes,
    totalProjectSessionMinutes,
    aiSummary,
    aiRecommendations,
  };
}
