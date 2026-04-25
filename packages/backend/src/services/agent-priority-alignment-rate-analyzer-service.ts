import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentPriorityAlignmentRateAnalyzerMetric {
  agentId: string;
  agentName: string;
  alignmentRate: number;
  highPriorityFirst: number;
  misalignedSessions: number;
  alignmentScore: number;
  avgResponseToHighPriority: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentPriorityAlignmentRateAnalyzerReport {
  metrics: AgentPriorityAlignmentRateAnalyzerMetric[];
  fleetAvgAlignmentScore: number;
  poorAlignmentAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentPriorityAlignmentRateAnalyzer(): Promise<AgentPriorityAlignmentRateAnalyzerReport> {
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

  const metrics: AgentPriorityAlignmentRateAnalyzerMetric[] = [];

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

    const highPriorityFirst = sorted.filter(
      s => s.status === 'completed' && s.durationMs != null && s.durationMs < avgDuration * 0.7
    ).length;

    const misalignedSessions = sorted.filter(
      s => s.status === 'failed' && s.durationMs != null && s.durationMs > avgDuration * 1.5
    ).length;

    const alignmentRate = totalSessions > 0
      ? Math.min(100, (highPriorityFirst / totalSessions) * 100 * 2)
      : 0;

    const avgResponseToHighPriority = highPriorityFirst > 0
      ? Math.round(
          sorted
            .filter(s => s.status === 'completed' && s.durationMs != null && s.durationMs < avgDuration * 0.7)
            .reduce((sum, s) => sum + (s.durationMs ?? 0), 0) / highPriorityFirst
        )
      : 0;

    const completionRate = totalSessions > 0
      ? sorted.filter(s => s.status === 'completed').length / totalSessions
      : 0;

    const alignmentScore = Math.min(100, Math.max(0,
      alignmentRate * 0.5 +
      completionRate * 100 * 0.3 +
      Math.max(0, 20 - misalignedSessions * 2)
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentAlign = recent.filter(s => s.status === 'completed').length / Math.max(1, recent.length) * 100;
    const olderAlign = older.filter(s => s.status === 'completed').length / Math.max(1, older.length) * 100;
    const trend = recentAlign > olderAlign + 5 ? 'improving' : recentAlign < olderAlign - 5 ? 'degrading' : 'stable';

    const rating = alignmentScore >= 80 ? 'excellent' : alignmentScore >= 60 ? 'good' : alignmentScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      alignmentRate: Math.round(alignmentRate * 10) / 10,
      highPriorityFirst,
      misalignedSessions,
      alignmentScore: Math.round(alignmentScore),
      avgResponseToHighPriority,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.alignmentScore - a.alignmentScore);

  const fleetAvgAlignmentScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.alignmentScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgAlignmentScore,
    poorAlignmentAgents: metrics.filter(m => m.alignmentScore < 40).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
