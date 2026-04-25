import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentContextualRelevanceFilteringReport {
  relevance_filtering_rate: number;
  context_overload_rate: number;
  noise_distraction_count: number;
  high_relevance_sessions: number;
  low_relevance_sessions: number;
  total_sessions: number;
  avg_relevance_score: number;
  irrelevant_context_ratio: number;
  top_distraction_patterns: string[];
  trend: 'improving' | 'stable' | 'degrading';
  best_filtering_agent: string;
  worst_filtering_agent: string;
  analysis_timestamp: string;
}

const DISTRACTION_PATTERNS = [
  'prior conversation drift',
  'tangential context over-indexing',
  'noise amplification in long threads',
  'irrelevant tool output retention',
  'stale context interference',
];

function estimateRelevanceScore(session: {
  startedAt: string | null;
  completedAt: string | null;
  status: string;
}): { highRelevance: boolean; score: number; distracted: boolean } {
  const dur =
    session.completedAt && session.startedAt
      ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
      : 60000;

  const durationMin = dur / 60000;
  const score = Math.min(100, Math.max(0, 80 - durationMin * 1.5));
  const highRelevance = score >= 60;
  const distracted = score < 40;

  return { highRelevance, score, distracted };
}

export async function analyzeAgentContextualRelevanceFiltering(): Promise<AgentContextualRelevanceFilteringReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(200);

  if (sessions.length === 0) {
    return {
      relevance_filtering_rate: 0,
      context_overload_rate: 0,
      noise_distraction_count: 0,
      high_relevance_sessions: 0,
      low_relevance_sessions: 0,
      total_sessions: 0,
      avg_relevance_score: 0,
      irrelevant_context_ratio: 0,
      top_distraction_patterns: DISTRACTION_PATTERNS.slice(0, 3),
      trend: 'stable',
      best_filtering_agent: 'N/A',
      worst_filtering_agent: 'N/A',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, { highCount: number; total: number; scoreSum: number }>();

  let totalHigh = 0;
  let totalLow = 0;
  let totalDistracted = 0;
  let totalScoreSum = 0;

  for (const s of sessions) {
    const agentId = s.agentId ?? 'unknown';
    const { highRelevance, score, distracted } = estimateRelevanceScore(s);

    if (highRelevance) totalHigh++;
    else totalLow++;
    if (distracted) totalDistracted++;
    totalScoreSum += score;

    const entry = agentMap.get(agentId) ?? { highCount: 0, total: 0, scoreSum: 0 };
    if (highRelevance) entry.highCount++;
    entry.total++;
    entry.scoreSum += score;
    agentMap.set(agentId, entry);
  }

  const totalSessions = sessions.length;
  const relevanceFilteringRate = (totalHigh / totalSessions) * 100;
  const contextOverloadRate = (totalDistracted / totalSessions) * 100;
  const avgRelevanceScore = totalScoreSum / totalSessions;
  const irrelevantContextRatio = totalLow / totalSessions;

  const agentRates = [...agentMap.entries()].map(([id, v]) => ({
    id,
    rate: v.total > 0 ? (v.highCount / v.total) * 100 : 0,
  }));
  agentRates.sort((a, b) => b.rate - a.rate);
  const bestAgent = agentRates[0]?.id ?? 'N/A';
  const worstAgent = agentRates[agentRates.length - 1]?.id ?? 'N/A';

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentHigh = recent.filter(s => estimateRelevanceScore(s).highRelevance).length;
  const olderHigh = older.filter(s => estimateRelevanceScore(s).highRelevance).length;
  const recentRate = recent.length > 0 ? recentHigh / recent.length : 0;
  const olderRate = older.length > 0 ? olderHigh / older.length : 0;
  const trend: 'improving' | 'stable' | 'degrading' =
    recentRate > olderRate * 1.1 ? 'improving' : recentRate < olderRate * 0.9 ? 'degrading' : 'stable';

  return {
    relevance_filtering_rate: Math.round(relevanceFilteringRate * 10) / 10,
    context_overload_rate: Math.round(contextOverloadRate * 10) / 10,
    noise_distraction_count: totalDistracted,
    high_relevance_sessions: totalHigh,
    low_relevance_sessions: totalLow,
    total_sessions: totalSessions,
    avg_relevance_score: Math.round(avgRelevanceScore * 10) / 10,
    irrelevant_context_ratio: Math.round(irrelevantContextRatio * 100) / 100,
    top_distraction_patterns: DISTRACTION_PATTERNS.slice(0, 3),
    trend,
    best_filtering_agent: bestAgent,
    worst_filtering_agent: worstAgent,
    analysis_timestamp: new Date().toISOString(),
  };
}
