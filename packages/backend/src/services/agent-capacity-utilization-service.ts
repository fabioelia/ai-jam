import { db } from '../db/connection.js';
import { agentSessions, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type UtilizationTier = 'optimal' | 'moderate' | 'imbalanced' | 'insufficient_data';

export interface AgentCapacityUtilizationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  totalSessionHours: number;
  avgSessionHours: number;
  observationWindowHours: number;
  utilizationRate: number;
  utilizationScore: number;
  utilizationTier: UtilizationTier;
}

export interface CapacityUtilizationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    overloadedCount: number;
    underutilizedCount: number;
    avgUtilizationRate: number;
    totalSessionHours: number;
  };
  agents: AgentCapacityUtilizationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeUtilizationScore(utilizationRate: number, totalSessions: number): number {
  if (totalSessions < 2) return 0;
  const deviation = Math.abs(utilizationRate - 0.55);
  return Math.round(Math.min(100, Math.max(0, 100 - deviation * 120)) * 10) / 10;
}

export function getUtilizationTier(score: number, totalSessions: number): UtilizationTier {
  if (totalSessions < 2) return 'insufficient_data';
  if (score >= 75) return 'optimal';
  if (score >= 45) return 'moderate';
  return 'imbalanced';
}

export function getUtilizationTierLabel(tier: UtilizationTier): string {
  switch (tier) {
    case 'optimal': return 'Optimal';
    case 'moderate': return 'Moderate';
    case 'imbalanced': return 'Imbalanced';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatUtilizationRate(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
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

export async function analyzeAgentCapacityUtilization(projectId: string): Promise<CapacityUtilizationReport> {
  const rows = await db
    .select({
      personaType: agentSessions.personaType,
      startedAt: agentSessions.startedAt,
      completedAt: agentSessions.completedAt,
    })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  type SessionRecord = { startedAt: Date | null; completedAt: Date | null };
  const agentMap = new Map<string, SessionRecord[]>();

  for (const row of rows) {
    const name = row.personaType;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ startedAt: row.startedAt, completedAt: row.completedAt });
  }

  const agents: AgentCapacityUtilizationMetrics[] = [];

  for (const [name, sessionList] of agentMap.entries()) {
    const totalSessions = sessionList.length;
    if (totalSessions === 0) continue;

    // totalSessionHours = sum of durations where both timestamps non-null
    let totalSessionHours = 0;
    for (const s of sessionList) {
      if (s.startedAt && s.completedAt) {
        totalSessionHours += (s.completedAt.getTime() - s.startedAt.getTime()) / 3600000;
      }
    }
    totalSessionHours = Math.round(totalSessionHours * 1000) / 1000;

    // observationWindowHours = (maxTime - minTime) / 3600000
    // maxTime = max of all (completedAt ?? Date.now())
    // minTime = min of all startedAt (non-null)
    const now = Date.now();
    const startTimes = sessionList.filter((s) => s.startedAt !== null).map((s) => s.startedAt!.getTime());
    const endTimes = sessionList.map((s) => (s.completedAt ? s.completedAt.getTime() : now));

    let observationWindowHours = 0;
    if (startTimes.length > 0) {
      const minTime = Math.min(...startTimes);
      const maxTime = Math.max(...endTimes);
      observationWindowHours = Math.round(((maxTime - minTime) / 3600000) * 1000) / 1000;
    }

    const utilizationRate =
      observationWindowHours > 0
        ? Math.round(Math.min(1, Math.max(0, totalSessionHours / observationWindowHours)) * 1000) / 1000
        : 0;

    const avgSessionHours =
      totalSessions > 0 ? Math.round((totalSessionHours / totalSessions) * 100) / 100 : 0;

    const utilizationScore = computeUtilizationScore(utilizationRate, totalSessions);
    const utilizationTier = getUtilizationTier(utilizationScore, totalSessions);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalSessions,
      totalSessionHours,
      avgSessionHours,
      observationWindowHours,
      utilizationRate,
      utilizationScore,
      utilizationTier,
    });
  }

  agents.sort((a, b) => b.utilizationScore - a.utilizationScore);

  const overloadedCount = agents.filter((a) => a.utilizationRate > 0.8).length;
  const underutilizedCount = agents.filter((a) => a.utilizationRate < 0.2 && a.totalSessions >= 2).length;
  const totalSessionHoursAll = Math.round(agents.reduce((s, a) => s + a.totalSessionHours, 0) * 100) / 100;
  const avgUtilizationRate =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.utilizationRate, 0) / agents.length) * 1000) / 1000
      : 0;

  const aiSummary =
    `Capacity utilization analysis complete for ${agents.length} agents. ` +
    `${overloadedCount} agents are overloaded (>80% utilization), ${underutilizedCount} are underutilized (<20%). ` +
    `Average utilization rate: ${(avgUtilizationRate * 100).toFixed(1)}%.`;

  const aiRecommendations = [
    'Overloaded agents risk burnout — redistribute tasks to balance workloads.',
    'Underutilized agents have capacity — assign them more tickets to improve throughput.',
    'Target 50-60% utilization for sustainable long-term agent performance.',
    'Monitor utilization trends over time to detect gradual overloading.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      overloadedCount,
      underutilizedCount,
      avgUtilizationRate,
      totalSessionHours: totalSessionHoursAll,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
