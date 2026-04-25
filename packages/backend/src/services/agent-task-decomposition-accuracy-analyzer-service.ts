import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentTaskDecompositionAccuracyAnalyzerMetric {
  agentId: string;
  agentName: string;
  decompositionScore: number;
  avgSubTasksPerSession: number;
  completionRate: number;
  overDecompositionRate: number;
  underDecompositionRate: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentTaskDecompositionAccuracyAnalyzerReport {
  metrics: AgentTaskDecompositionAccuracyAnalyzerMetric[];
  fleetAvgDecompositionScore: number;
  poorDecomposers: number;
  analysisTimestamp: string;
}

export async function analyzeAgentTaskDecompositionAccuracyAnalyzer(): Promise<AgentTaskDecompositionAccuracyAnalyzerReport> {
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

  const metrics: AgentTaskDecompositionAccuracyAnalyzerMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;

    const subTaskCounts = sorted.map(s => {
      const durationMs = s.completedAt
        ? new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime()
        : 60000;
      return Math.min(15, Math.max(1, Math.round(durationMs / 30000)));
    });

    const avgSubTasksPerSession = subTaskCounts.length > 0
      ? Math.round(subTaskCounts.reduce((a, b) => a + b, 0) / subTaskCounts.length * 10) / 10
      : 0;

    const completedSessions = sorted.filter(s => s.status === 'completed').length;
    const completionRate = totalSessions > 0
      ? Math.round(completedSessions / totalSessions * 100)
      : 0;

    const overDecompositionRate = subTaskCounts.length > 0
      ? Math.round(subTaskCounts.filter(c => c > 10).length / subTaskCounts.length * 100)
      : 0;

    const underDecompositionRate = subTaskCounts.length > 0
      ? Math.round(subTaskCounts.filter(c => c === 1).length / subTaskCounts.length * 100)
      : 0;

    const decompositionScore = Math.max(0, Math.min(100,
      completionRate * 0.5
      - overDecompositionRate * 0.25
      - underDecompositionRate * 0.25
      + 50
    ));

    const recent = sorted.slice(-10).filter(s => s.status === 'completed').length / Math.max(sorted.slice(-10).length, 1);
    const older = sorted.slice(-20, -10).filter(s => s.status === 'completed').length / Math.max(sorted.slice(-20, -10).length, 1);
    const trend = recent > older + 0.1 ? 'improving' : recent < older - 0.1 ? 'degrading' : 'stable';

    const rating = decompositionScore >= 80 ? 'excellent' : decompositionScore >= 60 ? 'good' : decompositionScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      decompositionScore: Math.round(decompositionScore),
      avgSubTasksPerSession,
      completionRate,
      overDecompositionRate,
      underDecompositionRate,
      totalSessions,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.decompositionScore - a.decompositionScore);

  const fleetAvgDecompositionScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.decompositionScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgDecompositionScore,
    poorDecomposers: metrics.filter(m => m.decompositionScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
