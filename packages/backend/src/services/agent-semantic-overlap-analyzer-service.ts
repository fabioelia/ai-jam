import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentSemanticOverlapAnalyzerMetric {
  agentId: string;
  agentName: string;
  noveltyScore: number;
  avgOverlapRate: number;
  repetitionBursts: number;
  uniqueTaskTypes: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentSemanticOverlapAnalyzerReport {
  metrics: AgentSemanticOverlapAnalyzerMetric[];
  fleetAvgNoveltyScore: number;
  highRepetitionAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentSemanticOverlapAnalyzer(): Promise<AgentSemanticOverlapAnalyzerReport> {
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

  const metrics: AgentSemanticOverlapAnalyzerMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const statuses = sorted.map(s => s.status ?? 'unknown');
    let overlapCount = 0;
    let repetitionBursts = 0;
    let burstLen = 0;

    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i] === statuses[i - 1]) {
        overlapCount++;
        burstLen++;
        if (burstLen >= 2) repetitionBursts++;
      } else {
        burstLen = 0;
      }
    }

    const avgOverlapRate = totalSessions > 1
      ? Math.round(overlapCount / (totalSessions - 1) * 100)
      : 0;

    const uniqueTaskTypes = new Set(statuses).size;

    const noveltyScore = Math.max(0, Math.min(100,
      100 - avgOverlapRate * 0.6 - repetitionBursts * 5
    ));

    const recent = statuses.slice(-10);
    const older = statuses.slice(-20, -10);
    const recentOverlap = recent.filter((s, i) => i > 0 && s === recent[i - 1]).length / Math.max(recent.length - 1, 1);
    const olderOverlap = older.filter((s, i) => i > 0 && s === older[i - 1]).length / Math.max(older.length - 1, 1);
    const trend = recentOverlap < olderOverlap - 0.1 ? 'improving' : recentOverlap > olderOverlap + 0.1 ? 'degrading' : 'stable';

    const rating = noveltyScore >= 80 ? 'excellent' : noveltyScore >= 60 ? 'good' : noveltyScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      noveltyScore: Math.round(noveltyScore),
      avgOverlapRate,
      repetitionBursts,
      uniqueTaskTypes,
      totalSessions,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.noveltyScore - a.noveltyScore);

  const fleetAvgNoveltyScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.noveltyScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgNoveltyScore,
    highRepetitionAgents: metrics.filter(m => m.repetitionBursts > 2).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
