import { db as defaultDb } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type DrizzleDb = typeof defaultDb;

export interface CategoryPerformance {
  category: string;
  ticketCount: number;
  completedCount: number;
  blockedCount: number;
  escalatedCount: number;
  avgResolutionDays: number;
  completionRate: number;
  performanceVsAvg: number;
}

export interface AgentKnowledgeGapMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalTickets: number;
  categoryBreakdown: CategoryPerformance[];
  gapCount: number;
  proficientCount: number;
  avgCompletionRate: number;
  overallGapScore: number;
  gapTier: string;
}

export interface KnowledgeGapReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    criticalGapsCount: number;
    minorGapsCount: number;
    proficientCount: number;
    avgGapScore: number;
    totalGapsDetected: number;
  };
  agents: AgentKnowledgeGapMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeGapScore(
  gapCount: number,
  totalCategories: number,
  avgCompletionRate: number,
  totalTickets: number,
): number {
  if (totalTickets < 3) return 0;
  const gapRatio = gapCount / Math.max(totalCategories, 1);
  const completionBonus = avgCompletionRate * 40;
  const gapPenalty = gapRatio * 60;
  const score = Math.max(0, Math.min(100, completionBonus + (60 - gapPenalty)));
  return Math.round(score * 10) / 10;
}

export function getGapTier(gapScore: number, totalTickets: number): string {
  if (totalTickets < 3) return 'insufficient_data';
  if (gapScore >= 75) return 'proficient';
  if (gapScore >= 45) return 'minor_gaps';
  return 'critical_gaps';
}

export function getGapTierLabel(tier: string): string {
  switch (tier) {
    case 'proficient': return 'Proficient';
    case 'minor_gaps': return 'Minor Gaps';
    case 'critical_gaps': return 'Critical Gaps';
    case 'insufficient_data': return 'Insufficient Data';
    default: return 'Insufficient Data';
  }
}

export function formatGapScore(score: number): string {
  return score.toFixed(1);
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

export async function analyzeAgentKnowledgeGaps(projectId: string, db: DrizzleDb = defaultDb): Promise<KnowledgeGapReport> {
  const rows = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  type TicketRecord = {
    status: string;
    category: string;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  const agentMap = new Map<string, TicketRecord[]>();

  for (const row of rows) {
    const name = row.assignedPersona;
    if (!name) continue;

    // Derive category from labels (cast) or fall back to priority
    const labels: string[] = (row as any).labels ?? [];
    const category = Array.isArray(labels) && labels.length > 0 ? labels[0] : (row.priority ?? 'general');

    if (!agentMap.has(name)) agentMap.set(name, []);
    agentMap.get(name)!.push({
      status: row.status,
      category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  const agents: AgentKnowledgeGapMetrics[] = [];

  for (const [name, agentTickets] of agentMap.entries()) {
    const totalTickets = agentTickets.length;
    if (totalTickets === 0) continue;

    // Group by category
    const catMap = new Map<string, TicketRecord[]>();
    for (const t of agentTickets) {
      if (!catMap.has(t.category)) catMap.set(t.category, []);
      catMap.get(t.category)!.push(t);
    }

    const completedAll = agentTickets.filter((t) => t.status === 'done').length;
    const avgCompletionRate = Math.round((completedAll / Math.max(totalTickets, 1)) * 10000) / 10000;

    const categoryBreakdown: CategoryPerformance[] = [];
    for (const [cat, catTickets] of catMap.entries()) {
      const ticketCount = catTickets.length;
      const completedCount = catTickets.filter((t) => t.status === 'done').length;
      const completionRate = Math.round((completedCount / Math.max(ticketCount, 1)) * 10000) / 10000;
      const performanceVsAvg = Math.round((completionRate - avgCompletionRate) * 10000) / 10000;

      // Compute avg resolution days for completed tickets
      const completedTickets = catTickets.filter((t) => t.status === 'done' && t.createdAt && t.updatedAt);
      const avgResolutionDays =
        completedTickets.length > 0
          ? completedTickets.reduce((sum, t) => {
              const diffMs = (t.updatedAt!.getTime()) - (t.createdAt!.getTime());
              return sum + diffMs / (1000 * 60 * 60 * 24);
            }, 0) / completedTickets.length
          : 0;

      categoryBreakdown.push({
        category: cat,
        ticketCount,
        completedCount,
        blockedCount: 0,
        escalatedCount: 0,
        avgResolutionDays: Math.round(avgResolutionDays * 100) / 100,
        completionRate,
        performanceVsAvg,
      });
    }

    // A gap: ticketCount >= 2 AND performanceVsAvg < -0.2
    const gapCount = categoryBreakdown.filter((c) => c.ticketCount >= 2 && c.performanceVsAvg < -0.2).length;
    const proficientCount = categoryBreakdown.filter((c) => c.ticketCount >= 2 && c.performanceVsAvg >= 0).length;

    const overallGapScore = computeGapScore(gapCount, categoryBreakdown.length, avgCompletionRate, totalTickets);
    const gapTier = getGapTier(overallGapScore, totalTickets);

    agents.push({
      agentId: name.toLowerCase().replace(/\s+/g, '-'),
      agentName: name,
      agentRole: agentRoleFromPersona(name),
      totalTickets,
      categoryBreakdown,
      gapCount,
      proficientCount,
      avgCompletionRate,
      overallGapScore,
      gapTier,
    });
  }

  agents.sort((a, b) => b.overallGapScore - a.overallGapScore);

  const proficientCount = agents.filter((a) => a.gapTier === 'proficient').length;
  const minorGapsCount = agents.filter((a) => a.gapTier === 'minor_gaps').length;
  const criticalGapsCount = agents.filter((a) => a.gapTier === 'critical_gaps').length;
  const totalGapsDetected = agents.reduce((s, a) => s + a.gapCount, 0);
  const avgGapScore =
    agents.length > 0
      ? Math.round((agents.reduce((s, a) => s + a.overallGapScore, 0) / agents.length) * 10) / 10
      : 0;

  const aiSummary =
    `Knowledge gap analysis complete for ${agents.length} agents. ` +
    `${proficientCount} proficient, ${criticalGapsCount} with critical gaps. ` +
    `${totalGapsDetected} total knowledge gaps detected across all agents.`;

  const aiRecommendations = [
    'Pair agents with critical gaps with proficient agents for knowledge transfer.',
    'Reassign tickets in gap categories to agents with stronger completion rates.',
    'Add targeted training or reference materials for high-gap ticket categories.',
    'Review whether critical-gap categories are overly complex or under-specified.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      criticalGapsCount,
      minorGapsCount,
      proficientCount,
      avgGapScore,
      totalGapsDetected,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
