import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';

export interface AgentSwitchMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  switchCount: number;
  switchRate: number;
  sameCategoryAvgMs: number;
  switchCategoryAvgMs: number;
  switchCostMs: number;
  switchCostPct: number;
  tier: 'high_cost' | 'moderate_cost' | 'low_cost' | 'flexible' | 'insufficient_data';
}

export interface AgentContextSwitchCostReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgSwitchCost: number;
    highCostCount: number;
    lowCostCount: number;
    flexibleCount: number;
  };
  agents: AgentSwitchMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeSwitchCost(
  switchCategoryAvgMs: number,
  sameCategoryAvgMs: number,
): { switchCostMs: number; switchCostPct: number } {
  const switchCostMs = switchCategoryAvgMs - sameCategoryAvgMs;
  const switchCostPct =
    sameCategoryAvgMs > 0
      ? Math.round((switchCostMs / sameCategoryAvgMs) * 1000) / 10
      : 0;
  return { switchCostMs, switchCostPct };
}

export function getSwitchCostTier(
  switchCostPct: number,
): 'high_cost' | 'moderate_cost' | 'low_cost' | 'flexible' {
  if (switchCostPct >= 25) return 'high_cost';
  if (switchCostPct >= 5) return 'moderate_cost';
  if (switchCostPct >= -10) return 'low_cost';
  return 'flexible';
}

export function getSwitchRateLabel(switchRate: number): string {
  if (switchRate >= 70) return 'High Switching';
  if (switchRate >= 40) return 'Moderate';
  return 'Low Switching';
}

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
  priority: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
};

export async function analyzeContextSwitchCost(
  projectId: string,
): Promise<AgentContextSwitchCostReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      priority: tickets.priority,
      updatedAt: tickets.updatedAt,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        isNotNull(tickets.assignedPersona),
      ),
    );

  const personaMap = new Map<string, TicketRow[]>();
  for (const t of allTickets) {
    if (!t.assignedPersona) continue;
    const key = t.assignedPersona;
    if (!personaMap.has(key)) personaMap.set(key, []);
    personaMap.get(key)!.push(t);
  }

  const agents: AgentSwitchMetrics[] = [];
  let agentIdx = 0;

  for (const [persona, agentTickets] of personaMap.entries()) {
    agentIdx++;
    const totalSessions = agentTickets.length;

    if (totalSessions < 4) {
      agents.push({
        agentId: `agent-${agentIdx}`,
        agentName: persona,
        agentRole: persona,
        totalSessions,
        switchCount: 0,
        switchRate: 0,
        sameCategoryAvgMs: 0,
        switchCategoryAvgMs: 0,
        switchCostMs: 0,
        switchCostPct: 0,
        tier: 'insufficient_data',
      });
      continue;
    }

    const sorted = [...agentTickets].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return aTime - bTime;
    });

    let switchCount = 0;
    const sameCategoryMs: number[] = [];
    const switchCategoryMs: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const isSwitch = prev.priority !== curr.priority;
      if (isSwitch) switchCount++;

      if (curr.status === 'done' && curr.createdAt && curr.updatedAt) {
        const durationMs =
          new Date(curr.updatedAt).getTime() - new Date(curr.createdAt).getTime();
        if (isSwitch) {
          switchCategoryMs.push(durationMs);
        } else {
          sameCategoryMs.push(durationMs);
        }
      }
    }

    const sameCategoryAvgMs =
      sameCategoryMs.length > 0
        ? sameCategoryMs.reduce((a, b) => a + b, 0) / sameCategoryMs.length
        : 0;
    const switchCategoryAvgMs =
      switchCategoryMs.length > 0
        ? switchCategoryMs.reduce((a, b) => a + b, 0) / switchCategoryMs.length
        : 0;

    const { switchCostMs, switchCostPct } = computeSwitchCost(switchCategoryAvgMs, sameCategoryAvgMs);
    const switchRate = (switchCount / Math.max(totalSessions - 1, 1)) * 100;
    const tier = getSwitchCostTier(switchCostPct);

    agents.push({
      agentId: `agent-${agentIdx}`,
      agentName: persona,
      agentRole: persona,
      totalSessions,
      switchCount,
      switchRate: Math.round(switchRate * 10) / 10,
      sameCategoryAvgMs: Math.round(sameCategoryAvgMs),
      switchCategoryAvgMs: Math.round(switchCategoryAvgMs),
      switchCostMs: Math.round(switchCostMs),
      switchCostPct,
      tier,
    });
  }

  agents.sort((a, b) => b.switchCostPct - a.switchCostPct);

  const eligibleAgents = agents.filter((a) => a.tier !== 'insufficient_data');
  const avgSwitchCost =
    eligibleAgents.length > 0
      ? Math.round(
          (eligibleAgents.reduce((s, a) => s + a.switchCostPct, 0) / eligibleAgents.length) * 10,
        ) / 10
      : 0;

  const highCostCount = eligibleAgents.filter((a) => a.tier === 'high_cost').length;
  const lowCostCount = eligibleAgents.filter((a) => a.tier === 'low_cost').length;
  const flexibleCount = eligibleAgents.filter((a) => a.tier === 'flexible').length;

  const aiSummary = `Context switch cost analysis across ${agents.length} agents shows an average switch cost of ${avgSwitchCost}%. ${highCostCount} agent(s) show high context switch overhead while ${flexibleCount} agent(s) are flexible across task categories.`;

  const aiRecommendations = [
    'Batch similar-priority tasks together for high-cost agents to reduce context switching.',
    'Leverage flexible agents for cross-category work that requires frequent priority shifts.',
    'Monitor high-cost agents for signs of cognitive overload and consider workload restructuring.',
  ];

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgSwitchCost,
      highCostCount,
      lowCostCount,
      flexibleCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
