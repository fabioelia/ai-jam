import { db } from '../db/connection.js';
import { tickets, agentSessions, ticketNotes } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export interface AgentScopeDriftMetrics {
  agentId: string;
  agentName: string;
  totalTasks: number;
  outOfScopeTaskCount: number;
  scopeAdherenceRate: number;
  driftIncidents: number;
  avgDriftSeverity: 'minimal' | 'moderate' | 'significant' | 'critical';
  adherenceScore: number;
  adherenceTier: 'focused' | 'contained' | 'expanding' | 'unconstrained';
}

export interface AgentScopeDriftReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgAdherenceScore: number;
    mostFocused: string;
    mostDrifting: string;
    focusedAgents: number;
  };
  agents: AgentScopeDriftMetrics[];
  insights: string[];
  recommendations: string[];
}

export function computeDriftSeverity(
  driftIncidents: number,
  sessionCount: number,
): AgentScopeDriftMetrics['avgDriftSeverity'] {
  if (driftIncidents === 0) return 'minimal';
  const ratio = driftIncidents / Math.max(sessionCount, 1);
  if (ratio >= 0.5) return 'critical';
  if (ratio >= 0.3) return 'significant';
  if (ratio >= 0.1) return 'moderate';
  return 'minimal';
}

export function computeAdherenceScore(agent: {
  scopeAdherenceRate: number;
  driftIncidents: number;
  avgDriftSeverity: 'minimal' | 'moderate' | 'significant' | 'critical';
}): number {
  let score = agent.scopeAdherenceRate;
  if (agent.driftIncidents === 0) score += 10;
  if (agent.avgDriftSeverity === 'critical') score -= 20;
  else if (agent.avgDriftSeverity === 'significant') score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeAdherenceTier(
  score: number,
): AgentScopeDriftMetrics['adherenceTier'] {
  if (score >= 85) return 'focused';
  if (score >= 65) return 'contained';
  if (score >= 45) return 'expanding';
  return 'unconstrained';
}

type SessionRow = {
  id: string;
  ticketId: string | null;
  personaType: string;
  status: string;
};

type TicketRow = {
  id: string;
  assignedPersona: string | null;
  status: string;
};

export function buildScopeDriftMetrics(
  sessions: SessionRow[],
  projectTickets: TicketRow[],
): AgentScopeDriftMetrics[] {
  const personaSet = new Set<string>();
  for (const s of sessions) personaSet.add(s.personaType);
  for (const t of projectTickets) {
    if (t.assignedPersona) personaSet.add(t.assignedPersona);
  }

  const metrics: AgentScopeDriftMetrics[] = [];

  for (const persona of personaSet) {
    const personaSessions = sessions.filter((s) => s.personaType === persona);
    const personaTickets = projectTickets.filter((t) => t.assignedPersona === persona);

    const totalTasks = personaTickets.length;

    // outOfScopeTaskCount: tickets assigned but with no sessions (proxy for unworked/out-of-scope tickets)
    const ticketIdsWithSessions = new Set(personaSessions.map((s) => s.ticketId));
    const outOfScopeTaskCount = personaTickets.filter((t) => !ticketIdsWithSessions.has(t.id)).length;

    // scopeAdherenceRate: in-scope tasks / total tasks
    const scopeAdherenceRate = totalTasks > 0
      ? ((totalTasks - outOfScopeTaskCount) / totalTasks) * 100
      : 100;

    // driftIncidents: failed sessions on tickets that already have a completed session (rework proxy)
    let driftIncidents = 0;
    for (const ticketId of ticketIdsWithSessions) {
      const ticketSessions = personaSessions.filter((s) => s.ticketId === ticketId);
      const hasCompleted = ticketSessions.some((s) => s.status === 'completed');
      const failedAfterComplete = hasCompleted && ticketSessions.some((s) => s.status === 'failed');
      if (failedAfterComplete) driftIncidents++;
    }
    // Also count unworked tickets as drift incidents
    driftIncidents += outOfScopeTaskCount;

    const avgDriftSeverity = computeDriftSeverity(driftIncidents, personaSessions.length);
    const adherenceScore = computeAdherenceScore({
      scopeAdherenceRate,
      driftIncidents,
      avgDriftSeverity,
    });
    const adherenceTier = computeAdherenceTier(adherenceScore);

    metrics.push({
      agentId: persona,
      agentName: persona,
      totalTasks,
      outOfScopeTaskCount,
      scopeAdherenceRate: Math.round(scopeAdherenceRate * 10) / 10,
      driftIncidents,
      avgDriftSeverity,
      adherenceScore,
      adherenceTier,
    });
  }

  metrics.sort((a, b) => b.adherenceScore - a.adherenceScore);
  return metrics;
}

export function generateScopeDriftInsights(metrics: AgentScopeDriftMetrics[]): string[] {
  const insights: string[] = [];

  if (metrics.length === 0) {
    insights.push('No agent activity found for this project.');
    return insights;
  }

  const focused = metrics.filter((m) => m.adherenceTier === 'focused');
  const unconstrained = metrics.filter((m) => m.adherenceTier === 'unconstrained');

  if (focused.length > 0) {
    insights.push(`${focused.length} agent(s) demonstrate excellent scope focus: ${focused.map((m) => m.agentName).join(', ')}.`);
  }

  if (unconstrained.length > 0) {
    insights.push(`${unconstrained.length} agent(s) show significant scope drift and require immediate attention: ${unconstrained.map((m) => m.agentName).join(', ')}.`);
  }

  const avgAdherence = metrics.reduce((s, m) => s + m.scopeAdherenceRate, 0) / metrics.length;
  insights.push(`Team average scope adherence rate is ${Math.round(avgAdherence)}%.`);

  const zeroDrift = metrics.filter((m) => m.driftIncidents === 0);
  if (zeroDrift.length > 0) {
    insights.push(`${zeroDrift.length} agent(s) have zero drift incidents, indicating strong task discipline.`);
  }

  return insights;
}

export function generateScopeDriftRecommendations(metrics: AgentScopeDriftMetrics[]): string[] {
  const recommendations: string[] = [];

  const drifting = metrics.filter((m) => m.driftIncidents > 0);
  if (drifting.length > 0) {
    recommendations.push('Review task assignments for agents with drift incidents and ensure clear scope boundaries are defined upfront.');
  }

  const unworked = metrics.filter((m) => m.outOfScopeTaskCount > 0);
  if (unworked.length > 0) {
    recommendations.push('Investigate unworked ticket assignments — reassign or reprioritize tickets that agents have not started.');
  }

  recommendations.push('Implement scope check-ins at key milestones to catch drift early before it impacts delivery timelines.');

  return recommendations;
}

export async function analyzeAgentScopeDrift(
  projectId: string,
): Promise<AgentScopeDriftReport> {
  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  let allSessions: SessionRow[] = [];

  if (ticketIds.length > 0) {
    allSessions = await db
      .select({
        id: agentSessions.id,
        ticketId: agentSessions.ticketId,
        personaType: agentSessions.personaType,
        status: agentSessions.status,
      })
      .from(agentSessions)
      .where(inArray(agentSessions.ticketId, ticketIds));
  }

  if (allSessions.length === 0 && projectTickets.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgAdherenceScore: 0,
        mostFocused: '',
        mostDrifting: '',
        focusedAgents: 0,
      },
      agents: [],
      insights: ['No agent activity found for this project.'],
      recommendations: ['Ensure agents are actively working on tickets to generate scope drift data.'],
    };
  }

  const agents = buildScopeDriftMetrics(allSessions, projectTickets);

  const avgAdherenceScore =
    agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.adherenceScore, 0) / agents.length)
      : 0;
  const mostFocused = agents.length > 0 ? agents[0].agentName : '';
  const mostDrifting = agents.length > 0 ? agents[agents.length - 1].agentName : '';
  const focusedAgents = agents.filter((a) => a.adherenceScore >= 85).length;

  const insights = generateScopeDriftInsights(agents);
  const recommendations = generateScopeDriftRecommendations(agents);

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgAdherenceScore,
      mostFocused,
      mostDrifting,
      focusedAgents,
    },
    agents,
    insights,
    recommendations,
  };
}
