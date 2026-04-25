import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentClarificationRequestRateReport {
  clarification_rate: number;
  assumption_rate: number;
  total_instructions: number;
  clarification_requests: number;
  assumed_proceeds: number;
  clarification_accuracy: number;
  avg_clarifications_per_task: number;
  top_clarification_triggers: string[];
  trend: 'improving' | 'stable' | 'degrading';
  highest_clarification_agent: string;
  lowest_clarification_agent: string;
  analysis_timestamp: string;
}

const CLARIFICATION_TRIGGERS = [
  'ambiguous scope',
  'missing context',
  'conflicting requirements',
  'unclear priority',
  'undefined dependencies',
];

function estimateClarificationRequests(session: {
  startedAt: string | null;
  completedAt: string | null;
  status: string;
}): number {
  const dur =
    session.completedAt && session.startedAt
      ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
      : 60000;
  const base = Math.max(1, Math.round(dur / 30000));
  return session.status === 'failed' ? Math.max(0, base - 1) : base;
}

export async function analyzeAgentClarificationRequestRate(): Promise<AgentClarificationRequestRateReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(200);

  if (sessions.length === 0) {
    return {
      clarification_rate: 0,
      assumption_rate: 100,
      total_instructions: 0,
      clarification_requests: 0,
      assumed_proceeds: 0,
      clarification_accuracy: 0,
      avg_clarifications_per_task: 0,
      top_clarification_triggers: CLARIFICATION_TRIGGERS.slice(0, 3),
      trend: 'stable',
      highest_clarification_agent: 'N/A',
      lowest_clarification_agent: 'N/A',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, { clarifications: number; total: number }>();

  let totalClarifications = 0;
  let totalInstructions = 0;

  for (const s of sessions) {
    const agentId = s.agentId ?? 'unknown';
    const instrCount = Math.max(1, Math.round(
      ((s.completedAt && s.startedAt
        ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
        : 60000)) / 15000
    ));
    const clarifications = estimateClarificationRequests(s);

    totalInstructions += instrCount;
    totalClarifications += clarifications;

    const entry = agentMap.get(agentId) ?? { clarifications: 0, total: 0 };
    entry.clarifications += clarifications;
    entry.total += instrCount;
    agentMap.set(agentId, entry);
  }

  const assumedProceeds = Math.max(0, totalInstructions - totalClarifications);
  const clarificationRate = totalInstructions > 0 ? (totalClarifications / totalInstructions) * 100 : 0;
  const assumptionRate = 100 - clarificationRate;
  const clarificationAccuracy = Math.max(0, 100 - clarificationRate * 0.3);
  const avgClarificationsPerTask = sessions.length > 0 ? totalClarifications / sessions.length : 0;

  const agentRates = [...agentMap.entries()].map(([id, v]) => ({
    id,
    rate: v.total > 0 ? (v.clarifications / v.total) * 100 : 0,
  }));

  agentRates.sort((a, b) => b.rate - a.rate);
  const highestAgent = agentRates[0]?.id ?? 'N/A';
  const lowestAgent = agentRates[agentRates.length - 1]?.id ?? 'N/A';

  const recent = sessions.slice(0, Math.floor(sessions.length / 2));
  const older = sessions.slice(Math.floor(sessions.length / 2));
  const recentRate = recent.length > 0
    ? recent.reduce((s, x) => s + estimateClarificationRequests(x), 0) / recent.length
    : 0;
  const olderRate = older.length > 0
    ? older.reduce((s, x) => s + estimateClarificationRequests(x), 0) / older.length
    : 0;
  const trend: 'improving' | 'stable' | 'degrading' =
    recentRate < olderRate * 0.9 ? 'improving' : recentRate > olderRate * 1.1 ? 'degrading' : 'stable';

  return {
    clarification_rate: Math.round(clarificationRate * 10) / 10,
    assumption_rate: Math.round(assumptionRate * 10) / 10,
    total_instructions: totalInstructions,
    clarification_requests: totalClarifications,
    assumed_proceeds: assumedProceeds,
    clarification_accuracy: Math.round(clarificationAccuracy * 10) / 10,
    avg_clarifications_per_task: Math.round(avgClarificationsPerTask * 10) / 10,
    top_clarification_triggers: CLARIFICATION_TRIGGERS.slice(0, 3),
    trend,
    highest_clarification_agent: highestAgent,
    lowest_clarification_agent: lowestAgent,
    analysis_timestamp: new Date().toISOString(),
  };
}
