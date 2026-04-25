import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentConstraintSatisfactionMetric {
  agentId: string;
  satisfactionRate: number;
  totalConstraints: number;
  satisfiedConstraints: number;
  formatViolations: number;
  scopeViolations: number;
  safetyViolations: number;
  requirementGaps: number;
  formatComplianceRate: number;
  scopeAdherenceRate: number;
  safetyComplianceRate: number;
  requirementFulfillmentRate: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AgentConstraintSatisfactionReport {
  agents: AgentConstraintSatisfactionMetric[];
  summary: {
    satisfactionRate: number;
    totalConstraints: number;
    formatComplianceRate: number;
    scopeAdherenceRate: number;
    safetyComplianceRate: number;
    requirementFulfillmentRate: number;
    violationBreakdown: { format: number; scope: number; safety: number; requirements: number };
    trend: 'improving' | 'stable' | 'declining';
    mostCompliantAgent: string;
    leastCompliantAgent: string;
  };
}

export async function analyzeAgentConstraintSatisfactionRate(projectId: string): Promise<AgentConstraintSatisfactionReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      agents: [],
      summary: {
        satisfactionRate: 0,
        totalConstraints: 0,
        formatComplianceRate: 0,
        scopeAdherenceRate: 0,
        safetyComplianceRate: 0,
        requirementFulfillmentRate: 0,
        violationBreakdown: { format: 0, scope: 0, safety: 0, requirements: 0 },
        trend: 'stable',
        mostCompliantAgent: '',
        leastCompliantAgent: '',
      },
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agents: AgentConstraintSatisfactionMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const completed = sorted.filter(s => s.status === 'completed').length;
    const errors = sorted.filter(s => s.status === 'error').length;
    const running = sorted.filter(s => s.status === 'running').length;

    // Each session represents multiple constraint evaluations (heuristic: 4 per session)
    const totalConstraints = totalSessions * 4;
    const satisfiedConstraints = completed * 4;
    const formatViolations = errors;
    const scopeViolations = running;
    const safetyViolations = Math.max(0, errors - formatViolations);
    const requirementGaps = Math.max(0, totalConstraints - satisfiedConstraints - formatViolations - scopeViolations);

    const satisfactionRate = totalConstraints > 0
      ? Math.round((satisfiedConstraints / totalConstraints) * 100)
      : 0;
    const formatComplianceRate = totalSessions > 0
      ? Math.round(((totalSessions - formatViolations) / totalSessions) * 10000) / 100
      : 0;
    const scopeAdherenceRate = totalSessions > 0
      ? Math.round(((totalSessions - scopeViolations) / totalSessions) * 10000) / 100
      : 0;
    const safetyComplianceRate = totalSessions > 0
      ? Math.round(((totalSessions - safetyViolations) / totalSessions) * 10000) / 100
      : 100;
    const requirementFulfillmentRate = totalConstraints > 0
      ? Math.round((satisfiedConstraints / totalConstraints) * 10000) / 100
      : 0;

    const mid = Math.floor(sorted.length / 2);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (sorted.length >= 4) {
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);
      const firstRate = firstHalf.filter(s => s.status === 'completed').length / firstHalf.length;
      const secondRate = secondHalf.filter(s => s.status === 'completed').length / secondHalf.length;
      if (secondRate - firstRate > 0.1) trend = 'improving';
      else if (firstRate - secondRate > 0.1) trend = 'declining';
    }

    agents.push({
      agentId,
      satisfactionRate,
      totalConstraints,
      satisfiedConstraints,
      formatViolations,
      scopeViolations,
      safetyViolations,
      requirementGaps,
      formatComplianceRate,
      scopeAdherenceRate,
      safetyComplianceRate,
      requirementFulfillmentRate,
      trend,
    });
  }

  agents.sort((a, b) => b.satisfactionRate - a.satisfactionRate);

  const totalConstraints = agents.reduce((s, a) => s + a.totalConstraints, 0);
  const totalSatisfied = agents.reduce((s, a) => s + a.satisfiedConstraints, 0);
  const totalFormat = agents.reduce((s, a) => s + a.formatViolations, 0);
  const totalScope = agents.reduce((s, a) => s + a.scopeViolations, 0);
  const totalSafety = agents.reduce((s, a) => s + a.safetyViolations, 0);
  const totalReqGaps = agents.reduce((s, a) => s + a.requirementGaps, 0);
  const totalSessions = agents.reduce((s, a) => s + (a.totalConstraints / 4), 0);

  const summarySatisfactionRate = totalConstraints > 0 ? Math.round((totalSatisfied / totalConstraints) * 100) : 0;
  const summaryFormatRate = totalSessions > 0 ? Math.round(((totalSessions - totalFormat) / totalSessions) * 10000) / 100 : 0;
  const summaryScopeRate = totalSessions > 0 ? Math.round(((totalSessions - totalScope) / totalSessions) * 10000) / 100 : 0;
  const summarySafetyRate = totalSessions > 0 ? Math.round(((totalSessions - totalSafety) / totalSessions) * 10000) / 100 : 100;
  const summaryReqRate = totalConstraints > 0 ? Math.round((totalSatisfied / totalConstraints) * 10000) / 100 : 0;

  const improvingCount = agents.filter(a => a.trend === 'improving').length;
  const decliningCount = agents.filter(a => a.trend === 'declining').length;
  const summaryTrend: 'improving' | 'stable' | 'declining' =
    improvingCount > decliningCount ? 'improving' :
    decliningCount > improvingCount ? 'declining' : 'stable';

  return {
    agents,
    summary: {
      satisfactionRate: summarySatisfactionRate,
      totalConstraints,
      formatComplianceRate: summaryFormatRate,
      scopeAdherenceRate: summaryScopeRate,
      safetyComplianceRate: summarySafetyRate,
      requirementFulfillmentRate: summaryReqRate,
      violationBreakdown: { format: totalFormat, scope: totalScope, safety: totalSafety, requirements: totalReqGaps },
      trend: summaryTrend,
      mostCompliantAgent: agents[0]?.agentId ?? '',
      leastCompliantAgent: agents[agents.length - 1]?.agentId ?? '',
    },
  };
}
