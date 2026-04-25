import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentKnowledgeBoundaryMappingAnalyzerMetric {
  agentId: string;
  agentName: string;
  knowledgeCoverageScore: number;
  boundaryRespectRate: number;
  silentFailureRate: number;
  gapDensity: number;
  boundaryScore: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentKnowledgeBoundaryMappingAnalyzerReport {
  metrics: AgentKnowledgeBoundaryMappingAnalyzerMetric[];
  fleetAvgBoundaryScore: number;
  overconfidentAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentKnowledgeBoundaryMappingAnalyzer(): Promise<AgentKnowledgeBoundaryMappingAnalyzerReport> {
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

  const metrics: AgentKnowledgeBoundaryMappingAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const sorted = agentSessionList.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const completedSessions = sorted.filter(s => s.status === 'completed').length;
    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const cancelledSessions = sorted.filter(s => s.status === 'cancelled').length;

    const silentFailureRate = totalSessions > 0
      ? (errorSessions / totalSessions) * 100
      : 0;

    const boundaryRespectRate = totalSessions > 0
      ? (cancelledSessions / totalSessions) * 100
      : 0;

    const knowledgeCoverageScore = totalSessions > 0
      ? (completedSessions / totalSessions) * 100
      : 0;

    const gapDensity = totalSessions > 0
      ? (errorSessions / totalSessions) * 10
      : 0;

    const boundaryScore = Math.min(100, Math.max(0,
      knowledgeCoverageScore * 0.4 +
      (100 - silentFailureRate) * 0.4 +
      Math.min(100, boundaryRespectRate * 2) * 0.2
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentScore = recent.filter(s => s.status === 'completed').length / Math.max(1, recent.length) * 100;
    const olderScore = older.filter(s => s.status === 'completed').length / Math.max(1, older.length) * 100;
    const trend: 'improving' | 'stable' | 'degrading' = recentScore > olderScore + 5 ? 'improving' : recentScore < olderScore - 5 ? 'degrading' : 'stable';

    const rating: 'excellent' | 'good' | 'fair' | 'poor' = boundaryScore >= 80 ? 'excellent' : boundaryScore >= 60 ? 'good' : boundaryScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      knowledgeCoverageScore: Math.round(knowledgeCoverageScore * 10) / 10,
      boundaryRespectRate: Math.round(boundaryRespectRate * 10) / 10,
      silentFailureRate: Math.round(silentFailureRate * 10) / 10,
      gapDensity: Math.round(gapDensity * 10) / 10,
      boundaryScore: Math.round(boundaryScore),
      totalSessions,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.boundaryScore - a.boundaryScore);

  const fleetAvgBoundaryScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.boundaryScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgBoundaryScore,
    overconfidentAgents: metrics.filter(m => m.silentFailureRate > 30).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
