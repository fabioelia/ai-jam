import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentSemanticDriftMetric {
  agentId: string;
  agentName: string;
  driftScore: number;
  totalSessions: number;
  sessionsWithDrift: number;
  driftRate: number;
  averageDriftMagnitude: number;
  peakDriftSession: string;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'stable' | 'mild' | 'moderate' | 'severe';
}

export interface AgentSemanticDriftReport {
  metrics: AgentSemanticDriftMetric[];
  driftScore: number;
  driftRate: number;
  averageDriftMagnitude: number;
  peakDriftSession: string;
  trend: 'improving' | 'stable' | 'degrading';
  mostStableAgent: string;
  mostDriftedAgent: string;
  fleetAvgDriftScore: number;
  highDriftAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentSemanticDrift(): Promise<AgentSemanticDriftReport> {
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

  const metrics: AgentSemanticDriftMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const retryTotal = sorted.reduce((sum, s) => sum + (s.retryCount ?? 0), 0);

    const sessionsWithDrift = Math.round((errorSessions + retryTotal * 0.3) / Math.max(1, total) * total * 0.5);
    const driftRate = total === 0 ? 0 : Math.min(100, Math.round((sessionsWithDrift / total) * 100));
    const averageDriftMagnitude = sessionsWithDrift > 0
      ? Math.round((errorSessions / Math.max(1, sessionsWithDrift)) * 50 * 10) / 10
      : 0;

    const driftScore = Math.min(100, Math.max(0, Math.round(driftRate * 0.7 + averageDriftMagnitude * 0.3)));

    const peakSession = sorted.filter(s => s.status === 'error')[0];
    const peakDriftSession = peakSession?.id ?? 'none';

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentErrors = recent.filter(s => s.status === 'error').length / Math.max(1, recent.length);
    const olderErrors = older.filter(s => s.status === 'error').length / Math.max(1, older.length);
    const trend: AgentSemanticDriftMetric['trend'] =
      recentErrors < olderErrors - 0.05 ? 'improving' :
      recentErrors > olderErrors + 0.05 ? 'degrading' : 'stable';

    const rating: AgentSemanticDriftMetric['rating'] =
      driftScore < 20 ? 'stable' :
      driftScore < 40 ? 'mild' :
      driftScore < 70 ? 'moderate' : 'severe';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      driftScore,
      totalSessions: total,
      sessionsWithDrift,
      driftRate,
      averageDriftMagnitude,
      peakDriftSession,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => a.driftScore - b.driftScore);

  const fleetAvgDriftScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.driftScore, 0) / metrics.length)
    : 0;

  const fleetDriftRate = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.driftRate, 0) / metrics.length)
    : 0;

  const fleetAvgMagnitude = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.averageDriftMagnitude, 0) / metrics.length * 10) / 10
    : 0;

  const trendCounts = { improving: 0, stable: 0, degrading: 0 };
  for (const m of metrics) trendCounts[m.trend]++;
  const fleetTrend: 'improving' | 'stable' | 'degrading' =
    trendCounts.improving > trendCounts.degrading ? 'improving' :
    trendCounts.degrading > trendCounts.improving ? 'degrading' : 'stable';

  const peakOverall = metrics.sort((a, b) => b.driftScore - a.driftScore)[0]?.peakDriftSession ?? 'none';
  metrics.sort((a, b) => a.driftScore - b.driftScore);

  return {
    metrics,
    driftScore: fleetAvgDriftScore,
    driftRate: fleetDriftRate,
    averageDriftMagnitude: fleetAvgMagnitude,
    peakDriftSession: peakOverall,
    trend: fleetTrend,
    mostStableAgent: metrics[0]?.agentName ?? 'N/A',
    mostDriftedAgent: metrics[metrics.length - 1]?.agentName ?? 'N/A',
    fleetAvgDriftScore,
    highDriftAgents: metrics.filter(m => m.driftScore >= 70).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
