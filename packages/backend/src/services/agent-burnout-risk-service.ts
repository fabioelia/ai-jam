import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type BurnoutRiskTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

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
  riskTier: BurnoutRiskTier;
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

export function computeBurnoutScore(
  sessionsPerDay: number,
  maxConsecutiveDays: number,
  avgRestIntervalHours: number,
): number {
  return (
    Math.round(
      Math.min(100, sessionsPerDay * 15 + maxConsecutiveDays * 5 + Math.max(0, 10 - avgRestIntervalHours) * 3) * 10,
    ) / 10
  );
}

export function getBurnoutRiskTier(score: number, totalSessions: number): BurnoutRiskTier {
  if (totalSessions < 2) return 'insufficient_data';
  if (score >= 70) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

export function getBurnoutRiskLabel(tier: BurnoutRiskTier): string {
  switch (tier) {
    case 'high':
      return 'High Risk';
    case 'moderate':
      return 'Moderate Risk';
    case 'low':
      return 'Low Risk';
    default:
      return 'Insufficient Data';
  }
}

function agentRoleFromPersona(personaType: string): string {
  const lower = personaType.toLowerCase();
  if (/frontend|ui|react|vue/.test(lower)) return 'Frontend Developer';
  if (/backend|api|server|node/.test(lower)) return 'Backend Developer';
  if (/test|qa|quality/.test(lower)) return 'QA Engineer';
  if (/devops|infra|deploy|cloud/.test(lower)) return 'DevOps Engineer';
  if (/data|analyst|ml|ai/.test(lower)) return 'Data Engineer';
  return 'Full Stack Developer';
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function computeMaxConsecutiveDays(sortedDates: Date[]): number {
  if (sortedDates.length === 0) return 0;

  // Collect unique calendar days
  const daySet = new Set<string>();
  for (const d of sortedDates) {
    daySet.add(dayKey(d));
  }

  // Sort unique days
  const uniqueDays = Array.from(daySet)
    .map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d);
    })
    .sort((a, b) => a.getTime() - b.getTime());

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = uniqueDays[i - 1];
    const curr = uniqueDays[i];
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

export async function analyzeBurnoutRisk(projectId: string): Promise<BurnoutRiskReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // Group by agent
  const agentMap = new Map<
    string,
    Array<{ startedAt: Date | null; completedAt: Date | null }>
  >();

  for (const s of sessions) {
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ startedAt: s.startedAt, completedAt: s.completedAt });
  }

  const agents: AgentBurnoutMetrics[] = [];

  for (const [name, agentSessionList] of agentMap.entries()) {
    // Sort by startedAt
    const sorted = agentSessionList
      .filter((s) => s.startedAt != null)
      .sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime());

    const totalSessions = agentSessionList.length;

    if (sorted.length === 0) {
      agents.push({
        agentId: name.toLowerCase().replace(/\s+/g, '-'),
        agentName: name,
        agentRole: agentRoleFromPersona(name),
        totalSessions,
        analysisWindowDays: 1,
        sessionsPerDay: 0,
        maxConsecutiveDays: 0,
        avgRestIntervalHours: 0,
        longestSessionMs: 0,
        burnoutScore: 0,
        riskTier: 'insufficient_data',
      });
      continue;
    }

    const firstSession = sorted[0];
    const lastSession = sorted[sorted.length - 1];

    const windowMs = lastSession.startedAt!.getTime() - firstSession.startedAt!.getTime();
    const windowDays = Math.max(1, windowMs / (1000 * 60 * 60 * 24));
    const analysisWindowDays = Math.max(1, Math.round(windowDays));

    const sessionsPerDay = Math.round((totalSessions / analysisWindowDays) * 100) / 100;

    const startDates = sorted.map((s) => s.startedAt!);
    const maxConsecutiveDays = computeMaxConsecutiveDays(startDates);

    // avgRestIntervalHours: gaps between consecutive sessions (completedAt → next startedAt)
    const restGaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      if (curr.completedAt != null && next.startedAt != null) {
        const gapMs = next.startedAt.getTime() - curr.completedAt.getTime();
        restGaps.push(gapMs / (1000 * 60 * 60));
      }
    }
    const avgRestIntervalHours =
      restGaps.length > 0
        ? Math.round((restGaps.reduce((s, g) => s + g, 0) / restGaps.length) * 100) / 100
        : 0;

    // longestSessionMs
    let longestSessionMs = 0;
    for (const s of agentSessionList) {
      if (s.startedAt != null && s.completedAt != null) {
        const dur = s.completedAt.getTime() - s.startedAt.getTime();
        if (dur > longestSessionMs) longestSessionMs = dur;
      }
    }

    const burnoutScore = computeBurnoutScore(sessionsPerDay, maxConsecutiveDays, avgRestIntervalHours);
    const riskTier = getBurnoutRiskTier(burnoutScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      analysisWindowDays,
      sessionsPerDay,
      maxConsecutiveDays,
      avgRestIntervalHours,
      longestSessionMs,
      burnoutScore,
      riskTier,
    });
  }

  agents.sort((a, b) => b.burnoutScore - a.burnoutScore);

  const highRiskCount = agents.filter((a) => a.riskTier === 'high').length;
  const moderateRiskCount = agents.filter((a) => a.riskTier === 'moderate').length;
  const lowRiskCount = agents.filter((a) => a.riskTier === 'low').length;
  const avgSessionsPerDay =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.sessionsPerDay, 0) / agents.length) * 100) / 100
      : 0;

  const aiSummary =
    `Burnout risk analysis complete for ${agents.length} agents. ` +
    `${highRiskCount} agents are at high risk, ${moderateRiskCount} at moderate risk, and ${lowRiskCount} at low risk. ` +
    `Monitoring session frequency and rest intervals is key to sustainable agent performance.`;

  const aiRecommendations = [
    'Reduce session frequency for high-risk agents to avoid performance degradation.',
    'Introduce mandatory rest intervals between consecutive sessions to allow recovery.',
    'Monitor longest session durations and set time limits to prevent overload.',
    'Review workload distribution to prevent individual agents from carrying too many consecutive sessions.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highRiskCount,
      moderateRiskCount,
      lowRiskCount,
      avgSessionsPerDay,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
