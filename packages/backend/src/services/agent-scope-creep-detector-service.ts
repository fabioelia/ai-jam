import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentScopeCreepDetectorMetric {
  agentId: string;
  agentName: string;
  scopeCreepScore: number;
  avgOverrunRatio: number;
  outOfScopeTaskRate: number;
  resourceOveruseRate: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentScopeCreepDetectorReport {
  metrics: AgentScopeCreepDetectorMetric[];
  fleetAvgScopeCreepScore: number;
  highRiskAgents: number;
  analysisTimestamp: string;
}

export async function detectAgentScopeCreep(): Promise<AgentScopeCreepDetectorReport> {
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

  const metrics: AgentScopeCreepDetectorMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    // Compute session durations using completedAt - startedAt (skip null)
    const sessionDurations: { duration: number; index: number }[] = [];
    for (let i = 0; i < agentSessions_.length; i++) {
      const s = agentSessions_[i];
      if (s.completedAt && s.startedAt) {
        const dur = s.completedAt.getTime() - s.startedAt.getTime();
        if (dur >= 0) sessionDurations.push({ duration: dur, index: i });
      }
    }

    if (sessionDurations.length === 0) {
      // No valid durations, use fallback
      const scopeCreepScore = 0;
      metrics.push({
        agentId,
        agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
        scopeCreepScore,
        avgOverrunRatio: 1,
        outOfScopeTaskRate: 0,
        resourceOveruseRate: 0,
        totalSessions: total,
        trend: 'stable',
        riskLevel: 'low',
      });
      continue;
    }

    const avgDuration = sessionDurations.reduce((a, b) => a + b.duration, 0) / sessionDurations.length;

    const overrunSessions = sessionDurations.filter(s => s.duration > avgDuration * 1.5).length;
    const outOfScopeTaskRate = (overrunSessions / total) * 100;
    const resourceOveruseRate = outOfScopeTaskRate; // duration proxy

    const avgOverrunRatio = sessionDurations.reduce((a, s) => a + s.duration / Math.max(1, avgDuration), 0) / sessionDurations.length;

    const scopeCreepScore =
      outOfScopeTaskRate * 0.5 +
      Math.min(100, (avgOverrunRatio - 1) * 50) * 0.3 +
      resourceOveruseRate * 0.2;

    // Trend: compare recent 10 vs older 10 overrun rates
    const recent = sessionDurations.filter(s => s.index < 10);
    const older = sessionDurations.filter(s => s.index >= 10 && s.index < 20);

    const recentOverrun = recent.length > 0
      ? recent.filter(s => s.duration > avgDuration * 1.5).length / recent.length
      : 0;
    const olderOverrun = older.length > 0
      ? older.filter(s => s.duration > avgDuration * 1.5).length / older.length
      : recentOverrun;

    const trend: AgentScopeCreepDetectorMetric['trend'] =
      recentOverrun > olderOverrun + 0.05 ? 'degrading' :
      recentOverrun < olderOverrun - 0.05 ? 'improving' : 'stable';

    const riskLevel: AgentScopeCreepDetectorMetric['riskLevel'] =
      scopeCreepScore >= 75 ? 'critical' :
      scopeCreepScore >= 50 ? 'high' :
      scopeCreepScore >= 25 ? 'medium' : 'low';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      scopeCreepScore: Math.round(scopeCreepScore * 10) / 10,
      avgOverrunRatio: Math.round(avgOverrunRatio * 100) / 100,
      outOfScopeTaskRate: Math.round(outOfScopeTaskRate * 10) / 10,
      resourceOveruseRate: Math.round(resourceOveruseRate * 10) / 10,
      totalSessions: total,
      trend,
      riskLevel,
    });
  }

  metrics.sort((a, b) => b.scopeCreepScore - a.scopeCreepScore);

  const fleetAvgScopeCreepScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.scopeCreepScore, 0) / metrics.length * 10) / 10
    : 0;

  return {
    metrics,
    fleetAvgScopeCreepScore,
    highRiskAgents: metrics.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical').length,
    analysisTimestamp: new Date().toISOString(),
  };
}
