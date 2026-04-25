import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type AvailabilityTier = 'high' | 'moderate' | 'low' | 'insufficient_data';

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
  availabilityTier: AvailabilityTier;
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

export function computeAvailabilityScore(
  totalSessions: number,
  totalActiveHours: number,
  avgSessionGapHours: number,
): number {
  if (totalSessions < 2) return 0;
  const raw =
    totalSessions * 3 +
    Math.min(40, totalActiveHours * 2) +
    Math.max(0, 20 - avgSessionGapHours);
  return Math.round(Math.min(100, raw) * 10) / 10;
}

export function getAvailabilityTier(availabilityScore: number, totalSessions: number): AvailabilityTier {
  if (totalSessions < 2) return 'insufficient_data';
  if (availabilityScore >= 70) return 'high';
  if (availabilityScore >= 35) return 'moderate';
  return 'low';
}

export function getAvailabilityTierLabel(tier: AvailabilityTier): string {
  switch (tier) {
    case 'high': return 'Highly Available';
    case 'moderate': return 'Moderately Available';
    case 'low': return 'Low Availability';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${(hours * 60).toFixed(0)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
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

export async function analyzeAgentAvailability(projectId: string): Promise<AvailabilityReport> {
  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  // Group sessions by personaType
  type SessionRecord = { startedAt: Date | null; completedAt: Date | null };
  const agentMap = new Map<string, SessionRecord[]>();

  for (const s of sessions) {
    const name = s.personaType;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ startedAt: s.startedAt, completedAt: s.completedAt });
  }

  const agents: AgentAvailabilityMetrics[] = [];

  for (const [name, agentSessionList] of agentMap.entries()) {
    const totalSessions = agentSessionList.length;

    // Total active hours
    let totalActiveHours = 0;
    for (const s of agentSessionList) {
      if (s.startedAt && s.completedAt) {
        totalActiveHours += (s.completedAt.getTime() - s.startedAt.getTime()) / 3600000;
      }
    }

    // Sort sessions by startedAt
    const sorted = agentSessionList
      .filter((s) => s.startedAt !== null)
      .sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime());

    // avgSessionGapHours and longestIdleHours
    let avgSessionGapHours = 0;
    let longestIdleHours = 0;

    if (sorted.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1].completedAt ?? sorted[i - 1].startedAt!;
        const nextStart = sorted[i].startedAt!;
        const gap = (nextStart.getTime() - prevEnd.getTime()) / 3600000;
        if (gap >= 0) gaps.push(gap);
      }
      if (gaps.length > 0) {
        avgSessionGapHours = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        longestIdleHours = Math.max(...gaps);
      }
    }

    // availabilityRate
    let availabilityRate = 0;
    if (sorted.length > 0) {
      const firstSessionStart = sorted[0].startedAt!;
      const lastSessionEnd = sorted[sorted.length - 1].completedAt ?? sorted[sorted.length - 1].startedAt!;
      const totalDaysMs = lastSessionEnd.getTime() - firstSessionStart.getTime();
      const totalDays = totalDaysMs / (24 * 3600000);

      // Last 24h of project activity
      const last24hThreshold = lastSessionEnd.getTime() - 24 * 3600000;
      const hasRecentSession = sorted.some((s) => s.startedAt!.getTime() >= last24hThreshold);

      if (hasRecentSession) {
        availabilityRate = 1.0;
      } else if (totalDays > 0) {
        // Ratio of active days to total days
        const activeDays = new Set(
          sorted.map((s) => {
            const d = s.startedAt!;
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          }),
        ).size;
        availabilityRate = Math.round((activeDays / totalDays) * 1000) / 1000;
      }
    }

    const availabilityScore = computeAvailabilityScore(totalSessions, totalActiveHours, avgSessionGapHours);
    const availabilityTier = getAvailabilityTier(availabilityScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      totalActiveHours: Math.round(totalActiveHours * 1000) / 1000,
      avgSessionGapHours: Math.round(avgSessionGapHours * 1000) / 1000,
      longestIdleHours: Math.round(longestIdleHours * 1000) / 1000,
      availabilityRate,
      availabilityScore,
      availabilityTier,
    });
  }

  agents.sort((a, b) => b.availabilityScore - a.availabilityScore);

  const highAvailabilityCount = agents.filter((a) => a.availabilityTier === 'high').length;
  const lowAvailabilityCount = agents.filter((a) => a.availabilityTier === 'low').length;
  const totalActiveHours = agents.reduce((s, a) => s + a.totalActiveHours, 0);
  const avgAvailabilityRate =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.availabilityRate, 0) / agents.length) * 1000) / 1000
      : 0;

  const aiSummary =
    `Availability analysis complete for ${agents.length} agents. ` +
    `${highAvailabilityCount} agents are highly available, ${lowAvailabilityCount} have low availability. ` +
    `Average availability rate: ${(avgAvailabilityRate * 100).toFixed(1)}%.`;

  const aiRecommendations = [
    'Agents with low availability may need workload adjustments or better task routing.',
    'High idle times suggest agents are waiting on dependencies — improve task handoff processes.',
    'Consider scheduling patterns that reduce long idle gaps between sessions.',
    'Pair low-availability agents with highly available ones to balance workloads.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highAvailabilityCount,
      lowAvailabilityCount,
      avgAvailabilityRate,
      totalActiveHours: Math.round(totalActiveHours * 100) / 100,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
