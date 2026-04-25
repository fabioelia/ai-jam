import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type VariabilityTier = 'stable' | 'moderate' | 'erratic' | 'insufficient_data';

export interface AgentThroughputVariabilityMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTicketsAnalyzed: number;
  weeklyThroughputs: number[];
  avgWeeklyThroughput: number;
  stdDevWeeklyThroughput: number;
  coefficientOfVariation: number;
  variabilityScore: number;
  variabilityTier: VariabilityTier;
}

export interface ThroughputVariabilityReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    highVariabilityCount: number;
    stableCount: number;
    avgCoefficientOfVariation: number;
    totalTicketsAnalyzed: number;
  };
  agents: AgentThroughputVariabilityMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeVariabilityScore(cv: number, totalTicketsAnalyzed: number): number {
  if (totalTicketsAnalyzed < 3) return 0;
  return Math.round(Math.min(100, Math.max(0, 100 - cv * 80)) * 10) / 10;
}

export function getVariabilityTier(score: number, totalTicketsAnalyzed: number): VariabilityTier {
  if (totalTicketsAnalyzed < 3) return 'insufficient_data';
  if (score >= 75) return 'stable';
  if (score >= 45) return 'moderate';
  return 'erratic';
}

export function getVariabilityTierLabel(tier: VariabilityTier): string {
  switch (tier) {
    case 'stable': return 'Stable';
    case 'moderate': return 'Moderate';
    case 'erratic': return 'Erratic';
    case 'insufficient_data': return 'Insufficient Data';
  }
}

export function formatCV(cv: number): string {
  return (cv * 100).toFixed(1) + '%';
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

export async function analyzeAgentThroughputVariability(projectId: string): Promise<ThroughputVariabilityReport> {
  const rows = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const weekOrigin = new Date('2024-01-01');
  const weekMs = 7 * 24 * 3600 * 1000;
  const now = new Date();
  const currentWeek = Math.floor((now.getTime() - weekOrigin.getTime()) / weekMs);
  const weeks = Array.from({ length: 8 }, (_, i) => currentWeek - 7 + i);

  type TicketRecord = { status: string; updatedAt: Date | null };
  const agentMap = new Map<string, TicketRecord[]>();

  for (const row of rows) {
    const name = row.assignedPersona;
    if (!name) continue;
    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({ status: row.status, updatedAt: row.updatedAt });
  }

  const agents: AgentThroughputVariabilityMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    // Count completed tickets per week
    const weekCounts = new Map<number, number>();
    for (const t of agentTickets) {
      if (t.status !== 'done' || !t.updatedAt) continue;
      const weekIdx = Math.floor((t.updatedAt.getTime() - weekOrigin.getTime()) / weekMs);
      weekCounts.set(weekIdx, (weekCounts.get(weekIdx) ?? 0) + 1);
    }

    const weeklyThroughputs = weeks.map((w) => weekCounts.get(w) ?? 0);
    const totalTicketsAnalyzed = weeklyThroughputs.reduce((s, v) => s + v, 0);
    if (totalTicketsAnalyzed === 0) continue;

    const avgWeeklyThroughput = Math.round((totalTicketsAnalyzed / 8) * 100) / 100;
    const variance =
      weeklyThroughputs.reduce((s, v) => s + Math.pow(v - avgWeeklyThroughput, 2), 0) / 8;
    const stdDevWeeklyThroughput = Math.round(Math.sqrt(variance) * 100) / 100;
    const coefficientOfVariation =
      avgWeeklyThroughput > 0
        ? Math.round((stdDevWeeklyThroughput / avgWeeklyThroughput) * 10000) / 10000
        : 0;

    const variabilityScore = computeVariabilityScore(coefficientOfVariation, totalTicketsAnalyzed);
    const variabilityTier = getVariabilityTier(variabilityScore, totalTicketsAnalyzed);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTicketsAnalyzed,
      weeklyThroughputs,
      avgWeeklyThroughput,
      stdDevWeeklyThroughput,
      coefficientOfVariation,
      variabilityScore,
      variabilityTier,
    });
  }

  agents.sort((a, b) => b.variabilityScore - a.variabilityScore);

  const highVariabilityCount = agents.filter((a) => a.variabilityTier === 'erratic').length;
  const stableCount = agents.filter((a) => a.variabilityTier === 'stable').length;
  const totalTicketsAnalyzed = agents.reduce((s, a) => s + a.totalTicketsAnalyzed, 0);
  const avgCoefficientOfVariation =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.coefficientOfVariation, 0) / agents.length) * 10000) / 10000
      : 0;

  const aiSummary =
    `Throughput variability analysis complete for ${agents.length} agents. ` +
    `${stableCount} agents show stable output, ${highVariabilityCount} are erratic. ` +
    `Average coefficient of variation: ${(avgCoefficientOfVariation * 100).toFixed(1)}%.`;

  const aiRecommendations = [
    'Erratic agents may be context-switching too frequently — reduce interruptions.',
    'Stable throughput indicates reliable planning; use these agents for predictable sprint commitments.',
    'High CV often correlates with external blockers — investigate dependency patterns.',
    'Review workload distribution to ensure consistent task assignment across weeks.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      highVariabilityCount,
      stableCount,
      avgCoefficientOfVariation,
      totalTicketsAnalyzed,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
