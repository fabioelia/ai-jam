import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentWorkflowTransitionMetrics {
  agentId: string;
  agentName: string;
  totalTransitions: number;
  avgTransitionTimeHours: number;
  fastestTransitionHours: number;
  slowestTransitionHours: number;
  stalledTickets: number;
  transitionEfficiencyScore: number;
  efficiencyTier: 'fluid' | 'steady' | 'sluggish' | 'blocked';
}

export interface WorkflowStateStats {
  state: string;
  avgDurationHours: number;
  ticketCount: number;
  stalledCount: number;
}

export interface AgentWorkflowTransitionReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    totalTransitions: number;
    avgTransitionTimeHours: number;
    fastestAgent: string | null;
    stalledTotal: number;
    fluidAgents: number;
  };
  agents: AgentWorkflowTransitionMetrics[];
  stateStats: WorkflowStateStats[];
  insights: string[];
  recommendations: string[];
  aiSummary?: string;
  aiRecommendations?: string[];
}

export function computeTransitionEfficiencyScore(
  avgTransitionTimeHours: number,
  stalledTickets: number,
  totalTransitions: number,
): number {
  if (totalTransitions === 0) return 0;
  const timeScore = Math.max(0, 100 - (avgTransitionTimeHours / 48) * 100);
  const stallRate = stalledTickets / totalTransitions;
  const stallPenalty = stallRate * 30;
  return Math.max(0, Math.min(100, Math.round(timeScore - stallPenalty)));
}

export function computeEfficiencyTier(
  score: number,
): 'fluid' | 'steady' | 'sluggish' | 'blocked' {
  if (score >= 75) return 'fluid';
  if (score >= 50) return 'steady';
  if (score >= 25) return 'sluggish';
  return 'blocked';
}

export async function analyzeAgentWorkflowTransitions(
  projectId: string,
): Promise<AgentWorkflowTransitionReport> {
  const now = new Date();
  const generatedAt = now.toISOString();

  const emptyReport: AgentWorkflowTransitionReport = {
    projectId,
    generatedAt,
    summary: {
      totalAgents: 0,
      totalTransitions: 0,
      avgTransitionTimeHours: 0,
      fastestAgent: null,
      stalledTotal: 0,
      fluidAgents: 0,
    },
    agents: [],
    stateStats: [],
    insights: ['No agent sessions found for this project.'],
    recommendations: [],
  };

  const projectTickets = await db
    .select({ id: tickets.id, status: tickets.status, createdAt: tickets.createdAt, updatedAt: tickets.updatedAt })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  if (ticketIds.length === 0) return emptyReport;

  const sessionRows = await db
    .select()
    .from(agentSessions)
    .where(inArray(agentSessions.ticketId, ticketIds));

  if (sessionRows.length === 0) return emptyReport;

  // Group sessions by personaType
  const agentMap = new Map<
    string,
    { transitionHours: number[]; stalled: number }
  >();

  for (const s of sessionRows) {
    const id = s.personaType;
    if (!agentMap.has(id)) {
      agentMap.set(id, { transitionHours: [], stalled: 0 });
    }
    const e = agentMap.get(id)!;

    const transitionHours =
      s.completedAt && s.startedAt
        ? (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 3600000
        : 0;
    e.transitionHours.push(Math.max(0, transitionHours));

    // Stalled: startedAt > 24h ago AND completedAt is null
    const isStalled =
      s.startedAt !== null &&
      s.completedAt === null &&
      now.getTime() - new Date(s.startedAt).getTime() > 24 * 3600 * 1000;
    if (isStalled) e.stalled += 1;
  }

  const agents: AgentWorkflowTransitionMetrics[] = [];

  for (const [personaType, d] of agentMap.entries()) {
    const totalTransitions = d.transitionHours.length;
    const avgTransitionTimeHours =
      totalTransitions > 0
        ? Math.round((d.transitionHours.reduce((a, b) => a + b, 0) / totalTransitions) * 100) / 100
        : 0;
    const fastestTransitionHours = totalTransitions > 0 ? Math.min(...d.transitionHours) : 0;
    const slowestTransitionHours = totalTransitions > 0 ? Math.max(...d.transitionHours) : 0;
    const transitionEfficiencyScore = computeTransitionEfficiencyScore(
      avgTransitionTimeHours,
      d.stalled,
      totalTransitions,
    );

    agents.push({
      agentId: personaType,
      agentName: personaType,
      totalTransitions,
      avgTransitionTimeHours,
      fastestTransitionHours: Math.round(fastestTransitionHours * 100) / 100,
      slowestTransitionHours: Math.round(slowestTransitionHours * 100) / 100,
      stalledTickets: d.stalled,
      transitionEfficiencyScore,
      efficiencyTier: computeEfficiencyTier(transitionEfficiencyScore),
    });
  }

  agents.sort((a, b) => b.transitionEfficiencyScore - a.transitionEfficiencyScore);

  // State stats: group projectTickets by status
  const stateMap = new Map<string, { durations: number[]; stalledCount: number }>();

  for (const t of projectTickets) {
    const state = t.status;
    if (!stateMap.has(state)) {
      stateMap.set(state, { durations: [], stalledCount: 0 });
    }
    const e = stateMap.get(state)!;
    const durationHours =
      (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000;
    e.durations.push(Math.max(0, durationHours));

    // Stalled in this state if > 48h since updatedAt
    const hoursSinceUpdate = (now.getTime() - new Date(t.updatedAt).getTime()) / 3600000;
    if (hoursSinceUpdate > 48) e.stalledCount += 1;
  }

  const stateStats: WorkflowStateStats[] = [];
  for (const [state, s] of stateMap.entries()) {
    const avgDurationHours =
      s.durations.length > 0
        ? Math.round((s.durations.reduce((a, b) => a + b, 0) / s.durations.length) * 100) / 100
        : 0;
    stateStats.push({
      state,
      avgDurationHours,
      ticketCount: s.durations.length,
      stalledCount: s.stalledCount,
    });
  }

  const totalTransitions = agents.reduce((sum, a) => sum + a.totalTransitions, 0);
  const avgTransitionTimeHours =
    agents.length > 0
      ? Math.round(
          (agents.reduce((sum, a) => sum + a.avgTransitionTimeHours, 0) / agents.length) * 100,
        ) / 100
      : 0;
  const stalledTotal = agents.reduce((sum, a) => sum + a.stalledTickets, 0);
  const fluidAgents = agents.filter((a) => a.efficiencyTier === 'fluid').length;

  const fastestAgent =
    agents.length > 0
      ? agents.reduce((best, a) =>
          a.avgTransitionTimeHours < best.avgTransitionTimeHours ? a : best,
        ).agentName
      : null;

  const insights: string[] = [
    `${agents.length} agent(s) analyzed across ${totalTransitions} workflow transitions.`,
    `${fluidAgents} agent(s) operating at fluid efficiency tier.`,
  ];

  if (stalledTotal > 0) {
    insights.push(`${stalledTotal} stalled ticket(s) detected — requires attention.`);
  }

  const recommendations: string[] = [];
  if (avgTransitionTimeHours > 24) {
    recommendations.push(
      'Average transition time exceeds 24 hours. Review blockers and agent workload distribution.',
    );
  } else {
    recommendations.push('Workflow transitions are progressing at a healthy pace.');
  }

  return {
    projectId,
    generatedAt,
    summary: {
      totalAgents: agents.length,
      totalTransitions,
      avgTransitionTimeHours,
      fastestAgent,
      stalledTotal,
      fluidAgents,
    },
    agents,
    stateStats,
    insights,
    recommendations,
  };
}
