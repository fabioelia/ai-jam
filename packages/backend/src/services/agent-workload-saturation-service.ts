import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type SaturationTier = 'overloaded' | 'saturated' | 'healthy' | 'underutilized' | 'insufficient_data';

export interface AgentWorkloadSaturationMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  activeTickets: number;
  completedTickets: number;
  inProgressTickets: number;
  reviewTickets: number;
  avgTicketsPerDay: number;
  peakConcurrentTickets: number;
  saturationRate: number;
  saturationScore: number;
  saturationTier: SaturationTier;
}

export interface WorkloadSaturationReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    overloadedCount: number;
    saturatedCount: number;
    healthyCount: number;
    underutilizedCount: number;
    avgSaturationRate: number;
    totalActiveTickets: number;
  };
  agents: AgentWorkloadSaturationMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeSaturationScore(saturationRate: number, totalTickets: number): number {
  if (totalTickets < 2) return 0;
  let score: number;
  if (saturationRate <= 0.5) {
    score = saturationRate * 60;
  } else if (saturationRate <= 1.0) {
    score = 30 + (saturationRate - 0.5) * 80;
  } else {
    score = Math.min(100, 70 + (saturationRate - 1.0) * 30);
  }
  return Math.round(score * 10) / 10;
}

export function getSaturationTier(saturationScore: number, totalTickets: number): SaturationTier {
  if (totalTickets < 2) return 'insufficient_data';
  if (saturationScore >= 85) return 'overloaded';
  if (saturationScore >= 60) return 'saturated';
  if (saturationScore >= 30) return 'healthy';
  return 'underutilized';
}

export function getSaturationTierLabel(tier: SaturationTier): string {
  switch (tier) {
    case 'overloaded': return 'Overloaded';
    case 'saturated': return 'Saturated';
    case 'healthy': return 'Healthy';
    case 'underutilized': return 'Underutilized';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatSaturationRate(rate: number): string {
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

export async function analyzeAgentWorkloadSaturation(projectId: string): Promise<WorkloadSaturationReport> {
  const rows = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const now = new Date();

  // Determine project age from earliest ticket
  const createdAts = rows.map((r) => r.createdAt?.getTime() ?? now.getTime()).filter(Boolean);
  const projectStart = createdAts.length > 0 ? Math.min(...createdAts) : now.getTime();
  const projectDays = Math.max(1, Math.floor((now.getTime() - projectStart) / (24 * 3600 * 1000)));

  type TicketRecord = { status: string; updatedAt: Date | null };
  const agentMap = new Map<string, TicketRecord[]>();

  for (const row of rows) {
    const name = row.assignedPersona;
    if (!name) continue;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ status: row.status, updatedAt: row.updatedAt });
  }

  const agents: AgentWorkloadSaturationMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    const inProgressTickets = agentTickets.filter((t) => t.status === 'in_progress').length;
    const reviewTickets = agentTickets.filter((t) => t.status === 'review').length;
    const activeTickets = inProgressTickets + reviewTickets;
    const completedTickets = agentTickets.filter((t) => t.status === 'done').length;

    if (completedTickets + activeTickets === 0) continue;

    const totalTickets = completedTickets + activeTickets;
    const avgTicketsPerDay = Math.round((completedTickets / projectDays) * 100) / 100;
    const peakConcurrentTickets = activeTickets;
    const rawRate = activeTickets / Math.max(peakConcurrentTickets, 1);
    const saturationRate = Math.round(Math.min(2, Math.max(0, rawRate)) * 10000) / 10000;
    const saturationScore = computeSaturationScore(saturationRate, totalTickets);
    const saturationTier = getSaturationTier(saturationScore, totalTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      activeTickets,
      completedTickets,
      inProgressTickets,
      reviewTickets,
      avgTicketsPerDay,
      peakConcurrentTickets,
      saturationRate,
      saturationScore,
      saturationTier,
    });
  }

  agents.sort((a, b) => b.saturationScore - a.saturationScore);

  const overloadedCount = agents.filter((a) => a.saturationTier === 'overloaded').length;
  const saturatedCount = agents.filter((a) => a.saturationTier === 'saturated').length;
  const healthyCount = agents.filter((a) => a.saturationTier === 'healthy').length;
  const totalActiveTickets = agents.reduce((s, a) => s + a.activeTickets, 0);
  const avgSaturationRate =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.saturationRate, 0) / agents.length) * 10000) / 10000
      : 0;

  const aiSummary =
    `Workload saturation analysis complete for ${agents.length} agents. ` +
    `${overloadedCount} overloaded, ${healthyCount} healthy. ` +
    `Average saturation rate: ${formatSaturationRate(avgSaturationRate)}.`;

  const aiRecommendations = [
    'Overloaded agents risk quality degradation — redistribute active tickets immediately.',
    'Underutilized agents have capacity to absorb additional work from saturated peers.',
    'Healthy saturation (30-60%) optimizes throughput without risking burnout.',
    'Monitor saturation trends weekly to catch capacity issues before they escalate.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      overloadedCount,
      saturatedCount,
      healthyCount,
      underutilizedCount: agents.filter((a) => a.saturationTier === 'underutilized').length,
      avgSaturationRate,
      totalActiveTickets,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
