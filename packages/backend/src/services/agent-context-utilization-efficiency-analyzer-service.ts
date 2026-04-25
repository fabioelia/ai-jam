import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentContextUtilizationEfficiencyMetric {
  agentId: string;
  efficiencyScore: number;
  totalRetrievals: number;
  relevantRetrievals: number;
  irrelevantRetrievals: number;
  saturationEvents: number;
  unusedContextRate: number;
  relevantRetrievalRate: number;
  irrelevantRetrievalRate: number;
  saturationEventRate: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AgentContextUtilizationEfficiencyReport {
  agents: AgentContextUtilizationEfficiencyMetric[];
  summary: {
    efficiencyScore: number;
    totalRetrievals: number;
    relevantRetrievalRate: number;
    irrelevantRetrievalRate: number;
    saturationEventRate: number;
    unusedContextRate: number;
    trend: 'improving' | 'stable' | 'declining';
    mostEfficientAgent: string;
    leastEfficientAgent: string;
  };
}

export async function analyzeAgentContextUtilizationEfficiency(projectId: string): Promise<AgentContextUtilizationEfficiencyReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      agents: [],
      summary: {
        efficiencyScore: 0,
        totalRetrievals: 0,
        relevantRetrievalRate: 0,
        irrelevantRetrievalRate: 0,
        saturationEventRate: 0,
        unusedContextRate: 0,
        trend: 'stable',
        mostEfficientAgent: '',
        leastEfficientAgent: '',
      },
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agents: AgentContextUtilizationEfficiencyMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalRetrievals = sorted.length;
    const completed = sorted.filter(s => s.status === 'completed').length;
    const errors = sorted.filter(s => s.status === 'error').length;
    const running = sorted.filter(s => s.status === 'running').length;

    // Relevant retrievals: completed sessions used context well
    const relevantRetrievals = completed;
    // Irrelevant: error sessions (context not useful)
    const irrelevantRetrievals = errors;
    // Saturation: running sessions (context window may be saturated)
    const saturationEvents = running;
    // Unused context: remaining
    const unusedContextCount = Math.max(0, totalRetrievals - completed - errors - running);

    const relevantRetrievalRate = totalRetrievals > 0 ? Math.round((relevantRetrievals / totalRetrievals) * 10000) / 100 : 0;
    const irrelevantRetrievalRate = totalRetrievals > 0 ? Math.round((irrelevantRetrievals / totalRetrievals) * 10000) / 100 : 0;
    const saturationEventRate = totalRetrievals > 0 ? Math.round((saturationEvents / totalRetrievals) * 10000) / 100 : 0;
    const unusedContextRate = totalRetrievals > 0 ? Math.round((unusedContextCount / totalRetrievals) * 10000) / 100 : 0;

    const efficiencyScore = Math.round(relevantRetrievalRate);

    // Trend: compare first half vs second half
    const mid = Math.floor(sorted.length / 2);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (sorted.length >= 4) {
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);
      const firstEff = firstHalf.filter(s => s.status === 'completed').length / firstHalf.length;
      const secondEff = secondHalf.filter(s => s.status === 'completed').length / secondHalf.length;
      if (secondEff - firstEff > 0.1) trend = 'improving';
      else if (firstEff - secondEff > 0.1) trend = 'declining';
    }

    agents.push({
      agentId,
      efficiencyScore,
      totalRetrievals,
      relevantRetrievals,
      irrelevantRetrievals,
      saturationEvents,
      unusedContextRate,
      relevantRetrievalRate,
      irrelevantRetrievalRate,
      saturationEventRate,
      trend,
    });
  }

  agents.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  const totalRetrievals = agents.reduce((s, a) => s + a.totalRetrievals, 0);
  const totalRelevant = agents.reduce((s, a) => s + a.relevantRetrievals, 0);
  const totalIrrelevant = agents.reduce((s, a) => s + a.irrelevantRetrievals, 0);
  const totalSaturation = agents.reduce((s, a) => s + a.saturationEvents, 0);
  const totalUnused = agents.reduce((s, a) => s + (a.unusedContextRate * a.totalRetrievals / 100), 0);

  const summaryEfficiency = totalRetrievals > 0 ? Math.round((totalRelevant / totalRetrievals) * 100) : 0;
  const summaryRelevantRate = totalRetrievals > 0 ? Math.round((totalRelevant / totalRetrievals) * 10000) / 100 : 0;
  const summaryIrrelevantRate = totalRetrievals > 0 ? Math.round((totalIrrelevant / totalRetrievals) * 10000) / 100 : 0;
  const summarySaturationRate = totalRetrievals > 0 ? Math.round((totalSaturation / totalRetrievals) * 10000) / 100 : 0;
  const summaryUnusedRate = totalRetrievals > 0 ? Math.round((totalUnused / totalRetrievals) * 10000) / 100 : 0;

  const improvingCount = agents.filter(a => a.trend === 'improving').length;
  const decliningCount = agents.filter(a => a.trend === 'declining').length;
  const summaryTrend: 'improving' | 'stable' | 'declining' =
    improvingCount > decliningCount ? 'improving' :
    decliningCount > improvingCount ? 'declining' : 'stable';

  return {
    agents,
    summary: {
      efficiencyScore: summaryEfficiency,
      totalRetrievals,
      relevantRetrievalRate: summaryRelevantRate,
      irrelevantRetrievalRate: summaryIrrelevantRate,
      saturationEventRate: summarySaturationRate,
      unusedContextRate: summaryUnusedRate,
      trend: summaryTrend,
      mostEfficientAgent: agents[0]?.agentId ?? '',
      leastEfficientAgent: agents[agents.length - 1]?.agentId ?? '',
    },
  };
}
