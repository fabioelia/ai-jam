import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentParallelismEfficiencyAnalyzerMetric {
  agentId: string;
  agentName: string;
  parallelismRate: number;
  maxConcurrentSessions: number;
  avgConcurrentSessions: number;
  idleGapRate: number;
  parallelismScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentParallelismEfficiencyAnalyzerReport {
  metrics: AgentParallelismEfficiencyAnalyzerMetric[];
  fleetAvgParallelismScore: number;
  highIdleAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentParallelismEfficiencyAnalyzer(): Promise<AgentParallelismEfficiencyAnalyzerReport> {
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

  const metrics: AgentParallelismEfficiencyAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    if (agentSessionList.length < 2) continue;

    const sorted = agentSessionList.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;

    let concurrentPairs = 0;
    let maxConcurrent = 1;
    for (let i = 0; i < sorted.length; i++) {
      let concurrent = 1;
      const startI = new Date(sorted[i].createdAt).getTime();
      for (let j = i + 1; j < sorted.length; j++) {
        const startJ = new Date(sorted[j].createdAt).getTime();
        if (startJ - startI < 60000) {
          concurrent++;
          concurrentPairs++;
        } else {
          break;
        }
      }
      maxConcurrent = Math.max(maxConcurrent, concurrent);
    }

    const avgConcurrentSessions = totalSessions > 1
      ? Math.round((concurrentPairs / totalSessions) * 10) / 10 + 1
      : 1;

    const parallelismRate = totalSessions > 1
      ? Math.min(100, (concurrentPairs / Math.max(1, totalSessions - 1)) * 100)
      : 0;

    let totalSpan = 0;
    let totalDuration = 0;
    if (sorted.length >= 2) {
      const first = new Date(sorted[0].createdAt).getTime();
      const last = new Date(sorted[sorted.length - 1].createdAt).getTime();
      totalSpan = last - first;
      totalDuration = sorted.reduce((sum, s) => sum + (s.durationMs ?? 30000), 0);
    }
    const idleGapRate = totalSpan > 0
      ? Math.max(0, Math.min(100, ((totalSpan - totalDuration) / totalSpan) * 100))
      : 50;

    const parallelismScore = Math.min(100, Math.max(0,
      parallelismRate * 0.5 +
      (100 - idleGapRate) * 0.3 +
      Math.min(maxConcurrent * 10, 20)
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentParallel = recent.filter((s, i) => {
      if (i === 0) return false;
      const gap = new Date(s.createdAt).getTime() - new Date(recent[i - 1].createdAt).getTime();
      return gap < 60000;
    }).length / Math.max(1, recent.length - 1) * 100;
    const olderParallel = older.filter((s, i) => {
      if (i === 0) return false;
      const gap = new Date(s.createdAt).getTime() - new Date(older[i - 1].createdAt).getTime();
      return gap < 60000;
    }).length / Math.max(1, older.length - 1) * 100;
    const trend = recentParallel > olderParallel + 5 ? 'improving' : recentParallel < olderParallel - 5 ? 'degrading' : 'stable';

    const rating = parallelismScore >= 80 ? 'excellent' : parallelismScore >= 60 ? 'good' : parallelismScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      parallelismRate: Math.round(parallelismRate * 10) / 10,
      maxConcurrentSessions: maxConcurrent,
      avgConcurrentSessions: Math.round(avgConcurrentSessions * 10) / 10,
      idleGapRate: Math.round(idleGapRate * 10) / 10,
      parallelismScore: Math.round(parallelismScore),
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.parallelismScore - a.parallelismScore);

  const fleetAvgParallelismScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.parallelismScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgParallelismScore,
    highIdleAgents: metrics.filter(m => m.idleGapRate > 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
