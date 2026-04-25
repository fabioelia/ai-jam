import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentSessionWarmUpTimeAnalyzerMetric {
  agentId: string;
  agentName: string;
  avgWarmUpMs: number;
  warmUpRatio: number;
  coldStartSessions: number;
  hotStartSessions: number;
  warmUpScore: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentSessionWarmUpTimeAnalyzerReport {
  metrics: AgentSessionWarmUpTimeAnalyzerMetric[];
  fleetAvgWarmUpScore: number;
  slowWarmUpAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentSessionWarmUpTimeAnalyzer(): Promise<AgentSessionWarmUpTimeAnalyzerReport> {
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

  const metrics: AgentSessionWarmUpTimeAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const sorted = agentSessionList.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;

    const durations = sorted
      .filter(s => s.durationMs != null && s.durationMs > 0)
      .map(s => s.durationMs!);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
      gaps.push(gap);
    }

    const avgWarmUpMs = Math.round(avgDuration * 0.1);

    const warmUpRatio = avgDuration > 0
      ? Math.min(100, (avgWarmUpMs / avgDuration) * 100)
      : 0;

    const coldStartSessions = gaps.filter(g => g > 300000).length;
    const hotStartSessions = gaps.filter(g => g < 60000).length;

    const hotStartBonus = totalSessions > 1
      ? (hotStartSessions / Math.max(1, totalSessions - 1)) * 30
      : 0;
    const warmUpScore = Math.min(100, Math.max(0,
      (100 - warmUpRatio) * 0.5 +
      hotStartBonus +
      (coldStartSessions === 0 ? 20 : Math.max(0, 20 - coldStartSessions * 2))
    ));

    const recent = gaps.slice(-10);
    const older = gaps.slice(-20, -10);
    const recentHot = recent.filter(g => g < 60000).length / Math.max(1, recent.length) * 100;
    const olderHot = older.filter(g => g < 60000).length / Math.max(1, older.length) * 100;
    const trend = recentHot > olderHot + 5 ? 'improving' : recentHot < olderHot - 5 ? 'degrading' : 'stable';

    const rating = warmUpScore >= 80 ? 'excellent' : warmUpScore >= 60 ? 'good' : warmUpScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      avgWarmUpMs,
      warmUpRatio: Math.round(warmUpRatio * 10) / 10,
      coldStartSessions,
      hotStartSessions,
      warmUpScore: Math.round(warmUpScore),
      totalSessions,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.warmUpScore - a.warmUpScore);

  const fleetAvgWarmUpScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.warmUpScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgWarmUpScore,
    slowWarmUpAgents: metrics.filter(m => m.warmUpScore < 40).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
