import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentHypothesisTestingRateAnalyzerMetric {
  agentId: string;
  agentName: string;
  hypothesisTestingRate: number;
  avgIterationsPerSession: number;
  explorationDepth: number;
  quickCommitRate: number;
  hypothesisScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentHypothesisTestingRateAnalyzerReport {
  metrics: AgentHypothesisTestingRateAnalyzerMetric[];
  fleetAvgHypothesisScore: number;
  quickCommitAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentHypothesisTestingRateAnalyzer(): Promise<AgentHypothesisTestingRateAnalyzerReport> {
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

  const metrics: AgentHypothesisTestingRateAnalyzerMetric[] = [];

  for (const [agentId, agSessions] of agentMap) {
    if (agSessions.length < 2) continue;

    const sorted = agSessions.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const clusters: (typeof sessions)[] = [];
    let currentCluster: typeof sessions = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
      if (gap < 300000) {
        currentCluster.push(sorted[i]);
      } else {
        clusters.push(currentCluster);
        currentCluster = [sorted[i]];
      }
    }
    clusters.push(currentCluster);

    const multiStepClusters = clusters.filter(c => c.length > 1).length;
    const hypothesisTestingRate = clusters.length > 0
      ? Math.round((multiStepClusters / clusters.length) * 100)
      : 0;

    const avgIterationsPerSession = clusters.length > 0
      ? Math.round((clusters.reduce((sum, c) => sum + c.length, 0) / clusters.length) * 10) / 10
      : 1;

    const explorationDepth = multiStepClusters > 0
      ? Math.round((clusters.filter(c => c.length > 1).reduce((sum, c) => sum + c.length, 0) / multiStepClusters) * 10) / 10
      : 1;

    const quickCommitRate = clusters.length > 0
      ? Math.round(((clusters.length - multiStepClusters) / clusters.length) * 100)
      : 100;

    const hypothesisScore = Math.min(100, Math.max(0,
      hypothesisTestingRate * 0.5 +
      Math.min(avgIterationsPerSession * 10, 30) +
      (100 - quickCommitRate) * 0.2
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const countRate = (arr: typeof sessions) => arr.length > 1
      ? arr.filter((_, i) => {
          if (i === 0) return false;
          const gap = new Date(arr[i].createdAt).getTime() - new Date(arr[i - 1].createdAt).getTime();
          return gap < 300000;
        }).length / (arr.length - 1) * 100
      : 0;
    const recentRate = countRate(recent);
    const olderRate = countRate(older);
    const trend = recentRate > olderRate + 5 ? 'improving' : recentRate < olderRate - 5 ? 'degrading' : 'stable';
    const rating = hypothesisScore >= 80 ? 'excellent' : hypothesisScore >= 60 ? 'good' : hypothesisScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      hypothesisTestingRate,
      avgIterationsPerSession,
      explorationDepth,
      quickCommitRate,
      hypothesisScore: Math.round(hypothesisScore),
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.hypothesisScore - a.hypothesisScore);

  const fleetAvgHypothesisScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.hypothesisScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgHypothesisScore,
    quickCommitAgents: metrics.filter(m => m.quickCommitRate > 70).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
