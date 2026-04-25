import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentOutputDiversityAnalyzerMetric {
  agentId: string;
  agentName: string;
  diversityScore: number;
  uniqueStatusCount: number;
  statusDistribution: Record<string, number>;
  repetitionRate: number;
  adaptabilityScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentOutputDiversityAnalyzerReport {
  metrics: AgentOutputDiversityAnalyzerMetric[];
  fleetAvgDiversityScore: number;
  lowDiversityAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentOutputDiversityAnalyzer(): Promise<AgentOutputDiversityAnalyzerReport> {
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

  const metrics: AgentOutputDiversityAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const statuses = agentSessions_.map(s => (s as any).status ?? 'unknown');

    const statusCounts: Record<string, number> = {};
    for (const s of statuses) {
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    const uniqueStatusCount = Object.keys(statusCounts).length;

    let consecutiveSame = 0;
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i] === statuses[i - 1]) consecutiveSame++;
    }
    const repetitionRate = statuses.length > 1
      ? (consecutiveSame / (statuses.length - 1)) * 100
      : 0;

    // Shannon entropy
    const entropy = Object.values(statusCounts).reduce((acc, count) => {
      const p = count / total;
      return acc - p * Math.log2(p);
    }, 0);
    const maxEntropy = Math.log2(Math.max(uniqueStatusCount, 2));
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    const diversityScore = Math.max(0, Math.min(100,
      normalizedEntropy * 60 + Math.min(uniqueStatusCount * 10, 30) + (100 - repetitionRate) * 0.1
    ));

    const recentStatuses = statuses.slice(0, Math.min(10, statuses.length));
    const recentUnique = new Set(recentStatuses).size;
    const adaptabilityScore = Math.min(100, recentUnique * 20);

    const recentSlice = statuses.slice(0, Math.min(10, statuses.length));
    const olderSlice = statuses.slice(Math.min(10, statuses.length), Math.min(20, statuses.length));

    let recentRepRate = 0;
    if (recentSlice.length > 1) {
      let rc = 0;
      for (let i = 1; i < recentSlice.length; i++) {
        if (recentSlice[i] === recentSlice[i - 1]) rc++;
      }
      recentRepRate = rc / (recentSlice.length - 1) * 100;
    }

    let olderRepRate = 0;
    if (olderSlice.length > 1) {
      let oc = 0;
      for (let i = 1; i < olderSlice.length; i++) {
        if (olderSlice[i] === olderSlice[i - 1]) oc++;
      }
      olderRepRate = oc / (olderSlice.length - 1) * 100;
    }

    let trend: AgentOutputDiversityAnalyzerMetric['trend'] = 'stable';
    if (olderSlice.length > 1) {
      if (recentRepRate < olderRepRate - 10) {
        trend = 'improving';
      } else if (recentRepRate > olderRepRate + 10) {
        trend = 'degrading';
      }
    }

    const rating: AgentOutputDiversityAnalyzerMetric['rating'] =
      diversityScore >= 80 ? 'excellent' :
      diversityScore >= 60 ? 'good' :
      diversityScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      diversityScore: Math.round(diversityScore * 10) / 10,
      uniqueStatusCount,
      statusDistribution: statusCounts,
      repetitionRate: Math.round(repetitionRate * 10) / 10,
      adaptabilityScore,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.diversityScore - a.diversityScore);

  const fleetAvgDiversityScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.diversityScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgDiversityScore,
    lowDiversityAgents: metrics.filter(m => m.diversityScore < 40).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
