import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentCapabilityBoundaryAwarenessAnalyzerMetric {
  agentId: string;
  agentName: string;
  boundaryAwarenessScore: number;
  overreachRate: number;
  underreachRate: number;
  appropriateRoutingRate: number;
  avgTaskComplexityHandled: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentCapabilityBoundaryAwarenessAnalyzerReport {
  metrics: AgentCapabilityBoundaryAwarenessAnalyzerMetric[];
  fleetAvgBoundaryAwarenessScore: number;
  poorBoundaryAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentCapabilityBoundaryAwarenessAnalyzer(): Promise<AgentCapabilityBoundaryAwarenessAnalyzerReport> {
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

  const metrics: AgentCapabilityBoundaryAwarenessAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const completedSessions = sorted.filter(s => s.status === 'completed').length;
    const errorSessions = sorted.filter(s => s.status === 'error').length;

    const overreachSessions = sorted.filter(s => s.status === 'error' && (s.durationMs ?? 0) > 5000).length;
    const overreachRate = totalSessions > 0 ? (overreachSessions / totalSessions) * 100 : 0;

    const avgDuration = sorted.reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / Math.max(1, totalSessions);
    const underreachSessions = sorted.filter(s => s.status === 'completed' && (s.durationMs ?? 0) < avgDuration * 0.1).length;
    const underreachRate = totalSessions > 0 ? (underreachSessions / totalSessions) * 100 : 0;

    const appropriateRoutingRate = Math.max(0, 100 - overreachRate - underreachRate);

    const avgTaskComplexityHandled = completedSessions > 0
      ? sorted.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / completedSessions
      : 0;

    const boundaryAwarenessScore = Math.min(100, Math.max(0,
      appropriateRoutingRate * 0.6 +
      (100 - overreachRate) * 0.3 +
      (100 - underreachRate) * 0.1
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentScore = recent.filter(s => s.status === 'completed').length / Math.max(1, recent.length) * 100;
    const olderScore = older.filter(s => s.status === 'completed').length / Math.max(1, older.length) * 100;
    const trend: AgentCapabilityBoundaryAwarenessAnalyzerMetric['trend'] =
      recentScore > olderScore + 5 ? 'improving' : recentScore < olderScore - 5 ? 'degrading' : 'stable';

    const rating: AgentCapabilityBoundaryAwarenessAnalyzerMetric['rating'] =
      boundaryAwarenessScore >= 80 ? 'excellent' :
      boundaryAwarenessScore >= 60 ? 'good' :
      boundaryAwarenessScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      boundaryAwarenessScore: Math.round(boundaryAwarenessScore),
      overreachRate: Math.round(overreachRate * 10) / 10,
      underreachRate: Math.round(underreachRate * 10) / 10,
      appropriateRoutingRate: Math.round(appropriateRoutingRate * 10) / 10,
      avgTaskComplexityHandled: Math.round(avgTaskComplexityHandled),
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.boundaryAwarenessScore - a.boundaryAwarenessScore);

  const fleetAvgBoundaryAwarenessScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.boundaryAwarenessScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgBoundaryAwarenessScore,
    poorBoundaryAgents: metrics.filter(m => m.boundaryAwarenessScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
