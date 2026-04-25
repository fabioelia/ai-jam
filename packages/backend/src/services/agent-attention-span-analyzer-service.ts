import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentAttentionSpanAnalyzerMetric {
  agentId: string;
  agentName: string;
  avgSessionDurationMs: number;
  maxSessionDurationMs: number;
  contextSwitchRate: number;
  focusScore: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentAttentionSpanAnalyzerReport {
  metrics: AgentAttentionSpanAnalyzerMetric[];
  fleetAvgFocusScore: number;
  shortAttentionAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentAttentionSpanAnalyzer(): Promise<AgentAttentionSpanAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = (session as any).agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const metrics: AgentAttentionSpanAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const durations = sorted
      .filter(s => s.startedAt && s.completedAt)
      .map(s => s.completedAt!.getTime() - s.startedAt!.getTime());

    const avgSessionDurationMs = durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 1000;
    const maxSessionDurationMs = durations.length > 0
      ? Math.max(...durations)
      : 1000;

    // Context switch rate: sessions per hour proxy
    const timespan = sorted.length > 1
      ? (new Date(sorted[sorted.length - 1].createdAt).getTime() - new Date(sorted[0].createdAt).getTime()) / 3600000
      : 1;
    const contextSwitchRate = Math.round((total / Math.max(0.1, timespan)) * 10) / 10;

    // Focus score: higher avg duration and lower switch rate = better
    const durationScore = Math.min(100, (avgSessionDurationMs / 60000) * 20); // 5min = 100
    const switchPenalty = Math.min(50, contextSwitchRate * 5);
    const focusScore = Math.min(100, Math.max(0, Math.round(durationScore - switchPenalty + 50)));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentDur = recent.filter(s => s.startedAt && s.completedAt)
      .map(s => s.completedAt!.getTime() - s.startedAt!.getTime());
    const olderDur = older.filter(s => s.startedAt && s.completedAt)
      .map(s => s.completedAt!.getTime() - s.startedAt!.getTime());
    const recentAvg = recentDur.length > 0 ? recentDur.reduce((s, d) => s + d, 0) / recentDur.length : avgSessionDurationMs;
    const olderAvg = olderDur.length > 0 ? olderDur.reduce((s, d) => s + d, 0) / olderDur.length : avgSessionDurationMs;
    const trend: AgentAttentionSpanAnalyzerMetric['trend'] =
      recentAvg > olderAvg * 1.05 ? 'improving' :
      recentAvg < olderAvg * 0.95 ? 'degrading' : 'stable';

    const rating: AgentAttentionSpanAnalyzerMetric['rating'] =
      focusScore >= 80 ? 'excellent' :
      focusScore >= 60 ? 'good' :
      focusScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      avgSessionDurationMs,
      maxSessionDurationMs,
      contextSwitchRate,
      focusScore,
      totalSessions: total,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.focusScore - a.focusScore);

  const fleetAvgFocusScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.focusScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgFocusScore,
    shortAttentionAgents: metrics.filter(m => m.focusScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
