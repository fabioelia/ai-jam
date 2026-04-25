import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type IdleTier = 'optimally_utilized' | 'moderately_idle' | 'highly_idle' | 'critically_idle' | 'insufficient_data';

export interface AgentIdleTimeMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalActiveTimeMs: number;
  totalIdleTimeMs: number;
  totalTrackedTimeMs: number;
  idleTimeRatio: number;
  avgIdlePeriodMs: number;
  longestIdlePeriodMs: number;
  idleScore: number;
  idleTier: IdleTier;
}

export interface IdleTimeReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highIdleCount: number;
    lowIdleCount: number;
    optimalCount: number;
    avgIdleTimeMs: number;
    totalIdleTimeMs: number;
  };
  agents: AgentIdleTimeMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeIdleScore(idleTimeRatio: number, _avgIdlePeriodMs: number, totalTrackedTimeMs: number): number {
  if (totalTrackedTimeMs < 3600000) return 0;
  let score: number;
  if (idleTimeRatio <= 0.2) {
    score = 90 - idleTimeRatio * 50;
  } else if (idleTimeRatio <= 0.4) {
    score = 80 - ((idleTimeRatio - 0.2) / 0.2) * 30;
  } else if (idleTimeRatio <= 0.7) {
    score = 50 - ((idleTimeRatio - 0.4) / 0.3) * 30;
  } else {
    score = Math.max(0, 20 - ((idleTimeRatio - 0.7) / 0.3) * 20);
  }
  return Math.round(score * 10) / 10;
}

export function getIdleTier(idleScore: number, totalTrackedTimeMs: number): IdleTier {
  if (totalTrackedTimeMs < 3600000) return 'insufficient_data';
  if (idleScore >= 80) return 'optimally_utilized';
  if (idleScore >= 55) return 'moderately_idle';
  if (idleScore >= 30) return 'highly_idle';
  return 'critically_idle';
}

export function getIdleTierLabel(tier: IdleTier): string {
  switch (tier) {
    case 'optimally_utilized': return 'Optimally Utilized';
    case 'moderately_idle': return 'Moderately Idle';
    case 'highly_idle': return 'Highly Idle';
    case 'critically_idle': return 'Critically Idle';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatIdleRatio(ratio: number): string {
  return (ratio * 100).toFixed(1) + '%';
}

export function formatDurationMs(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function agentRoleFromPersona(personaType: string): string {
  const lower = personaType.toLowerCase();
  if (/frontend|ui|react|vue/.test(lower)) return 'Frontend Developer';
  if (/backend|api|server|node/.test(lower)) return 'Backend Developer';
  if (/test|qa|quality/.test(lower)) return 'QA Engineer';
  if (/devops|infra|deploy|cloud/.test(lower)) return 'DevOps Engineer';
  if (/data|analyst|ml|ai/.test(lower)) return 'Data Engineer';
  return 'Software Engineer';
}

export async function analyzeAgentIdleTimeTracker(projectId: string): Promise<IdleTimeReport> {
  const allTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const agentMap = new Map<string, typeof allTickets>();
  for (const ticket of allTickets) {
    if (!ticket.assignedPersona) continue;
    if (!agentMap.has(ticket.assignedPersona)) agentMap.set(ticket.assignedPersona, []);
    agentMap.get(ticket.assignedPersona)!.push(ticket);
  }

  const agentMetrics: AgentIdleTimeMetrics[] = [];

  for (const [agentId, agentTickets] of agentMap.entries()) {
    const sorted = [...agentTickets].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let totalActiveTimeMs = 0;
    let totalIdleTimeMs = 0;
    let longestIdlePeriodMs = 0;
    let idlePeriodCount = 0;

    const periods: Array<{ start: number; end: number }> = sorted.map(t => ({
      start: new Date(t.createdAt).getTime(),
      end: new Date(t.updatedAt).getTime(),
    }));

    for (const p of periods) {
      totalActiveTimeMs += Math.max(0, p.end - p.start);
    }

    for (let i = 1; i < periods.length; i++) {
      const gap = periods[i].start - periods[i - 1].end;
      if (gap > 0) {
        totalIdleTimeMs += gap;
        longestIdlePeriodMs = Math.max(longestIdlePeriodMs, gap);
        idlePeriodCount++;
      }
    }

    const totalTrackedTimeMs = totalActiveTimeMs + totalIdleTimeMs;
    if (totalTrackedTimeMs === 0) continue;

    const idleTimeRatio = parseFloat((totalIdleTimeMs / Math.max(totalTrackedTimeMs, 1)).toFixed(4));
    const avgIdlePeriodMs = Math.round(totalIdleTimeMs / Math.max(idlePeriodCount, 1));
    const idleScore = computeIdleScore(idleTimeRatio, avgIdlePeriodMs, totalTrackedTimeMs);
    const idleTier = getIdleTier(idleScore, totalTrackedTimeMs);

    agentMetrics.push({
      agentId,
      agentName: agentId,
      agentRole: agentRoleFromPersona(agentId),
      totalActiveTimeMs,
      totalIdleTimeMs,
      totalTrackedTimeMs,
      idleTimeRatio,
      avgIdlePeriodMs,
      longestIdlePeriodMs,
      idleScore,
      idleTier,
    });
  }

  const totalIdleTimeMs = agentMetrics.reduce((s, a) => s + a.totalIdleTimeMs, 0);
  const highIdleCount = agentMetrics.filter(a => a.idleTier === 'highly_idle' || a.idleTier === 'critically_idle').length;
  const lowIdleCount = agentMetrics.filter(a => a.idleTier === 'optimally_utilized').length;
  const optimalCount = agentMetrics.filter(a => a.idleTier === 'moderately_idle').length;
  const avgIdleTimeMs = agentMetrics.length > 0
    ? Math.round(totalIdleTimeMs / agentMetrics.length)
    : 0;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agentMetrics.length,
      highIdleCount,
      lowIdleCount,
      optimalCount,
      avgIdleTimeMs,
      totalIdleTimeMs,
    },
    agents: agentMetrics,
    aiSummary: `Idle time analysis complete for ${agentMetrics.length} agents.`,
    aiRecommendations: [
      'Monitor agents with critically_idle tier for burnout signals.',
      'Consider redistributing tasks from optimally_utilized agents.',
    ],
  };
}
