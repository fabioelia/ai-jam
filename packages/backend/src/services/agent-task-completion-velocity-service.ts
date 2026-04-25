import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type VelocityTier = 'high' | 'moderate' | 'low' | 'insufficient_data';
export type VelocityTrend = 'improving' | 'declining' | 'stable' | 'insufficient_data';

export interface AgentVelocityMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalCompletedSessions: number;
  analysisWindowWeeks: number;
  avgSessionsPerWeek: number;
  recentWeekSessions: number;
  allTimeWeeklyPeak: number;
  velocityTrend: VelocityTrend;
  velocityScore: number;
  velocityTier: VelocityTier;
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

export function computeVelocityScore(
  avgSessionsPerWeek: number,
  recentWeekSessions: number,
  allTimeWeeklyPeak: number,
): number {
  const raw = avgSessionsPerWeek * 10 + allTimeWeeklyPeak * 3 + recentWeekSessions * 7;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

export function getVelocityTier(velocityScore: number, totalCompletedSessions: number): VelocityTier {
  if (totalCompletedSessions < 2) return 'insufficient_data';
  if (velocityScore >= 70) return 'high';
  if (velocityScore >= 35) return 'moderate';
  return 'low';
}

export function getVelocityTierLabel(tier: VelocityTier): string {
  switch (tier) {
    case 'high': return 'High Velocity';
    case 'moderate': return 'Steady';
    case 'low': return 'Low Velocity';
    default: return 'Insufficient Data';
  }
}

export function getVelocityTrendLabel(trend: VelocityTrend): string {
  switch (trend) {
    case 'improving': return '↑ Improving';
    case 'declining': return '↓ Declining';
    case 'stable': return '→ Stable';
    default: return '— N/A';
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

export async function analyzeTaskCompletionVelocity(projectId: string): Promise<TaskCompletionVelocityReport> {
  const now = new Date();

  const sessions = await db
    .select({
      personaType: agentSessions.personaType,
      status: agentSessions.status,
      startedAt: agentSessions.startedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  const agentMap = new Map<string, Date[]>();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const name = s.personaType ?? 'Unknown';
    if (!agentMap.has(name)) agentMap.set(name, []);
    if (s.startedAt != null) agentMap.get(name)!.push(s.startedAt);
  }

  const agents: AgentVelocityMetrics[] = [];

  for (const [name, dates] of agentMap.entries()) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    const totalCompletedSessions = dates.length;

    let analysisWindowWeeks = 1;
    if (totalCompletedSessions >= 2) {
      const spanMs = dates[dates.length - 1].getTime() - dates[0].getTime();
      analysisWindowWeeks = Math.max(1, Math.ceil(spanMs / (7 * 24 * 3600 * 1000)));
    }

    const avgSessionsPerWeek = totalCompletedSessions / analysisWindowWeeks;

    const recentCutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const recentWeekSessions = dates.filter((d) => d >= recentCutoff).length;

    // Rolling 7-day peak
    let allTimeWeeklyPeak = 0;
    if (totalCompletedSessions > 0) {
      const windowMs = 7 * 24 * 3600 * 1000;
      for (let i = 0; i < dates.length; i++) {
        const windowEnd = dates[i].getTime() + windowMs;
        const count = dates.filter((d) => d.getTime() >= dates[i].getTime() && d.getTime() < windowEnd).length;
        if (count > allTimeWeeklyPeak) allTimeWeeklyPeak = count;
      }
    }

    let velocityTrend: VelocityTrend = 'insufficient_data';
    if (totalCompletedSessions >= 2) {
      if (recentWeekSessions > avgSessionsPerWeek * 1.1) {
        velocityTrend = 'improving';
      } else if (recentWeekSessions < avgSessionsPerWeek * 0.7) {
        velocityTrend = 'declining';
      } else {
        velocityTrend = 'stable';
      }
    }

    const velocityScore = totalCompletedSessions < 2 ? 0 : computeVelocityScore(avgSessionsPerWeek, recentWeekSessions, allTimeWeeklyPeak);
    const velocityTier = getVelocityTier(velocityScore, totalCompletedSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalCompletedSessions,
      analysisWindowWeeks,
      avgSessionsPerWeek: Math.round(avgSessionsPerWeek * 100) / 100,
      recentWeekSessions,
      allTimeWeeklyPeak,
      velocityTrend,
      velocityScore,
      velocityTier,
    });
  }

  agents.sort((a, b) => b.velocityScore - a.velocityScore);

  const highVelocityCount = agents.filter((a) => a.velocityTier === 'high').length;
  const decliningCount = agents.filter((a) => a.velocityTrend === 'declining').length;
  const totalCompletedSessions = agents.reduce((sum, a) => sum + a.totalCompletedSessions, 0);
  const avgTicketsPerWeek =
    agents.length > 0
      ? Math.round((agents.reduce((sum, a) => sum + a.avgSessionsPerWeek, 0) / agents.length) * 100) / 100
      : 0;

  const aiSummary =
    `Task completion velocity analysis complete for ${agents.length} agents. ` +
    `${highVelocityCount} agents are operating at high velocity, while ${decliningCount} show declining trends. ` +
    `Average throughput is ${avgTicketsPerWeek.toFixed(1)} sessions per week across all agents.`;

  const aiRecommendations = [
    'Investigate declining agents for blockers, unclear tickets, or context-switching overhead.',
    'Assign high-velocity agents to critical path tickets to maintain sprint momentum.',
    'Review peak performance windows to schedule high-priority work during proven productive periods.',
    'Pair declining agents with high-velocity peers for knowledge sharing and momentum recovery.',
  ];

  return {
    projectId,
    generatedAt: now.toISOString(),
    summary: {
      totalAgents: agents.length,
      highVelocityCount,
      decliningCount,
      avgTicketsPerWeek,
      totalCompletedSessions,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
