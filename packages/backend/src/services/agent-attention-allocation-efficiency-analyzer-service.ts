import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentAttentionAllocationEfficiencyMetric {
  agentId: string;
  efficiency_score: number;
  is_optimal: boolean;
  is_misallocated: boolean;
  primary_focus_rate: number;
}

export interface AgentAttentionAllocationEfficiencyReport {
  allocation_efficiency_rate: number;
  primary_task_focus_rate: number;
  subtask_over_attention_rate: number;
  context_under_attention_rate: number;
  attention_waste_ratio: number;
  optimal_attention_sessions: number;
  misallocated_attention_sessions: number;
  total_sessions: number;
  avg_allocation_efficiency: number;
  top_misallocation_patterns: string[];
  trend: 'improving' | 'stable' | 'degrading';
  best_allocation_agent: string;
  worst_allocation_agent: string;
  analysis_timestamp: string;
}

const MISALLOCATION_PATTERNS = [
  'subtask over-indexing in long sessions',
  'context under-attention during tool-heavy tasks',
  'primary objective drift mid-session',
  'excessive tool result processing',
  'repeated context re-evaluation',
];

function estimateAttentionMetrics(session: {
  startedAt: string | null;
  completedAt: string | null;
  status: string;
}): { isOptimal: boolean; isMisallocated: boolean; efficiencyScore: number; primaryFocusRate: number } {
  const dur =
    session.completedAt && session.startedAt
      ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
      : 60000;

  const durationMin = dur / 60000;
  const isCompleted = session.status === 'completed';

  const efficiencyScore = Math.min(100, Math.max(0, isCompleted ? 85 - durationMin * 0.8 : 40 - durationMin * 0.5));
  const isOptimal = efficiencyScore >= 65;
  const isMisallocated = efficiencyScore < 45;
  const primaryFocusRate = Math.min(100, Math.max(0, efficiencyScore + 5));

  return { isOptimal, isMisallocated, efficiencyScore, primaryFocusRate };
}

export async function analyzeAgentAttentionAllocationEfficiency(): Promise<AgentAttentionAllocationEfficiencyReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(200);

  if (sessions.length === 0) {
    return {
      allocation_efficiency_rate: 0,
      primary_task_focus_rate: 0,
      subtask_over_attention_rate: 0,
      context_under_attention_rate: 0,
      attention_waste_ratio: 0,
      optimal_attention_sessions: 0,
      misallocated_attention_sessions: 0,
      total_sessions: 0,
      avg_allocation_efficiency: 0,
      top_misallocation_patterns: MISALLOCATION_PATTERNS.slice(0, 3),
      trend: 'stable',
      best_allocation_agent: 'N/A',
      worst_allocation_agent: 'N/A',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, { optimalCount: number; total: number; scoreSum: number }>();
  let totalOptimal = 0;
  let totalMisallocated = 0;
  let totalScoreSum = 0;
  let totalPrimaryFocus = 0;

  for (const s of sessions) {
    const agentId = s.agentId ?? 'unknown';
    const { isOptimal, isMisallocated, efficiencyScore, primaryFocusRate } = estimateAttentionMetrics(s);

    if (isOptimal) totalOptimal++;
    if (isMisallocated) totalMisallocated++;
    totalScoreSum += efficiencyScore;
    totalPrimaryFocus += primaryFocusRate;

    const entry = agentMap.get(agentId) ?? { optimalCount: 0, total: 0, scoreSum: 0 };
    if (isOptimal) entry.optimalCount++;
    entry.total++;
    entry.scoreSum += efficiencyScore;
    agentMap.set(agentId, entry);
  }

  const totalSessions = sessions.length;
  const allocationEfficiencyRate = (totalOptimal / totalSessions) * 100;
  const avgAllocationEfficiency = totalScoreSum / totalSessions;
  const avgPrimaryFocusRate = totalPrimaryFocus / totalSessions;
  const subtaskOverAttentionRate = (totalMisallocated / totalSessions) * 50;
  const contextUnderAttentionRate = Math.max(0, 100 - avgPrimaryFocusRate - subtaskOverAttentionRate);
  const attentionWasteRatio = totalMisallocated / totalSessions;

  const agentRates = [...agentMap.entries()].map(([id, v]) => ({
    id,
    rate: v.total > 0 ? v.scoreSum / v.total : 0,
  }));
  agentRates.sort((a, b) => b.rate - a.rate);
  const bestAgent = agentRates[0]?.id ?? 'N/A';
  const worstAgent = agentRates[agentRates.length - 1]?.id ?? 'N/A';

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentOptimal = recent.filter(s => estimateAttentionMetrics(s).isOptimal).length;
  const olderOptimal = older.filter(s => estimateAttentionMetrics(s).isOptimal).length;
  const recentRate = recent.length > 0 ? recentOptimal / recent.length : 0;
  const olderRate = older.length > 0 ? olderOptimal / older.length : 0;
  const trend: 'improving' | 'stable' | 'degrading' =
    recentRate > olderRate * 1.1 ? 'improving' : recentRate < olderRate * 0.9 ? 'degrading' : 'stable';

  return {
    allocation_efficiency_rate: Math.round(allocationEfficiencyRate * 10) / 10,
    primary_task_focus_rate: Math.round(avgPrimaryFocusRate * 10) / 10,
    subtask_over_attention_rate: Math.round(subtaskOverAttentionRate * 10) / 10,
    context_under_attention_rate: Math.round(contextUnderAttentionRate * 10) / 10,
    attention_waste_ratio: Math.round(attentionWasteRatio * 100) / 100,
    optimal_attention_sessions: totalOptimal,
    misallocated_attention_sessions: totalMisallocated,
    total_sessions: totalSessions,
    avg_allocation_efficiency: Math.round(avgAllocationEfficiency * 10) / 10,
    top_misallocation_patterns: MISALLOCATION_PATTERNS.slice(0, 3),
    trend,
    best_allocation_agent: bestAgent,
    worst_allocation_agent: worstAgent,
    analysis_timestamp: new Date().toISOString(),
  };
}
