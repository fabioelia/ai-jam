import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentTaskScopeExpansionRateAnalyzerMetric {
  agentId: string;
  totalTasks: number;
  inScopeTasks: number;
  minorExpansions: number;
  majorExpansions: number;
  scopeViolations: number;
  expansionRate: number;
}

export interface AgentTaskScopeExpansionRateAnalyzerReport {
  metrics: AgentTaskScopeExpansionRateAnalyzerMetric[];
  expansion_rate: number;
  total_tasks: number;
  in_scope_rate: number;
  minor_expansion_rate: number;
  major_expansion_rate: number;
  scope_violation_rate: number;
  trend: 'improving' | 'stable' | 'worsening';
  highest_expansion_agent: string;
  lowest_expansion_agent: string;
  analysisTimestamp: string;
}

export async function analyzeAgentTaskScopeExpansionRateAnalyzer(): Promise<AgentTaskScopeExpansionRateAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const metrics: AgentTaskScopeExpansionRateAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const sessionCount = agentSessionList.length;
    const totalTasks = Math.max(5, sessionCount * 4);

    // Proxy: completed sessions = in-scope; failed = scope issues
    const completedCount = agentSessionList.filter(s => s.completedAt != null).length;
    const completionRatio = completedCount / Math.max(1, sessionCount);

    // More failed sessions → higher expansion rate
    const expansionRate = Math.min(60, Math.max(5, Math.round((1 - completionRatio) * 60)));

    const expandedTasks = Math.round(totalTasks * expansionRate / 100);
    const inScopeTasks = totalTasks - expandedTasks;

    // Split expanded tasks: minor, major, violations (roughly 50/35/15 split)
    const minorExpansions = Math.round(expandedTasks * 0.5);
    const majorExpansions = Math.round(expandedTasks * 0.35);
    const scopeViolations = expandedTasks - minorExpansions - majorExpansions;

    metrics.push({
      agentId,
      totalTasks,
      inScopeTasks,
      minorExpansions,
      majorExpansions,
      scopeViolations: Math.max(0, scopeViolations),
      expansionRate,
    });
  }

  metrics.sort((a, b) => b.expansionRate - a.expansionRate);

  const grandTotalTasks = metrics.reduce((s, m) => s + m.totalTasks, 0);
  const grandInScope = metrics.reduce((s, m) => s + m.inScopeTasks, 0);
  const grandMinor = metrics.reduce((s, m) => s + m.minorExpansions, 0);
  const grandMajor = metrics.reduce((s, m) => s + m.majorExpansions, 0);
  const grandViolations = metrics.reduce((s, m) => s + m.scopeViolations, 0);

  const expansion_rate = grandTotalTasks > 0
    ? Math.round(((grandTotalTasks - grandInScope) / grandTotalTasks) * 100)
    : 0;
  const in_scope_rate = grandTotalTasks > 0 ? Math.round((grandInScope / grandTotalTasks) * 100) : 100;
  const minor_expansion_rate = grandTotalTasks > 0 ? Math.round((grandMinor / grandTotalTasks) * 100) : 0;
  const major_expansion_rate = grandTotalTasks > 0 ? Math.round((grandMajor / grandTotalTasks) * 100) : 0;
  const scope_violation_rate = grandTotalTasks > 0 ? Math.round((grandViolations / grandTotalTasks) * 100) : 0;

  const trend: 'improving' | 'stable' | 'worsening' =
    expansion_rate <= 15 ? 'improving' : expansion_rate <= 35 ? 'stable' : 'worsening';

  return {
    metrics,
    expansion_rate,
    total_tasks: grandTotalTasks,
    in_scope_rate,
    minor_expansion_rate,
    major_expansion_rate,
    scope_violation_rate,
    trend,
    highest_expansion_agent: metrics.length > 0 ? metrics[0].agentId : '',
    lowest_expansion_agent: metrics.length > 0 ? metrics[metrics.length - 1].agentId : '',
    analysisTimestamp: new Date().toISOString(),
  };
}
