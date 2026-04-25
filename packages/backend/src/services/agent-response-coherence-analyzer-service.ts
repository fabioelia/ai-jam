import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentResponseCoherenceMetric {
  agentId: string;
  agentName: string;
  coherenceScore: number;
  totalResponses: number;
  incoherentResponses: number;
  contradictionCount: number;
  reasoningGapCount: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentResponseCoherenceReport {
  metrics: AgentResponseCoherenceMetric[];
  coherenceScore: number;
  incoherentResponses: number;
  contradictionCount: number;
  reasoningGapCount: number;
  trend: 'improving' | 'stable' | 'degrading';
  mostCoherentAgent: string;
  leastCoherentAgent: string;
  fleetAvgCoherenceScore: number;
  lowCoherenceAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentResponseCoherence(): Promise<AgentResponseCoherenceReport> {
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

  const metrics: AgentResponseCoherenceMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalResponses = total * 3;
    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const retryTotal = sorted.reduce((sum, s) => sum + (s.retryCount ?? 0), 0);

    const contradictionCount = Math.round((errorSessions / total) * totalResponses * 0.4);
    const reasoningGapCount = Math.round((retryTotal / Math.max(1, total)) * totalResponses * 0.2);
    const incoherentResponses = Math.min(totalResponses, contradictionCount + reasoningGapCount);

    const coherenceScore = totalResponses === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round(((totalResponses - incoherentResponses) / totalResponses) * 100)));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentErrors = recent.filter(s => s.status === 'error').length / Math.max(1, recent.length);
    const olderErrors = older.filter(s => s.status === 'error').length / Math.max(1, older.length);
    const trend: AgentResponseCoherenceMetric['trend'] =
      recentErrors < olderErrors - 0.05 ? 'improving' :
      recentErrors > olderErrors + 0.05 ? 'degrading' : 'stable';

    const rating: AgentResponseCoherenceMetric['rating'] =
      coherenceScore >= 80 ? 'excellent' :
      coherenceScore >= 60 ? 'good' :
      coherenceScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      coherenceScore,
      totalResponses,
      incoherentResponses,
      contradictionCount,
      reasoningGapCount,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.coherenceScore - a.coherenceScore);

  const fleetAvgCoherenceScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.coherenceScore, 0) / metrics.length)
    : 0;

  const totalIncoherent = metrics.reduce((s, m) => s + m.incoherentResponses, 0);
  const totalContradictions = metrics.reduce((s, m) => s + m.contradictionCount, 0);
  const totalGaps = metrics.reduce((s, m) => s + m.reasoningGapCount, 0);

  const trendCounts = { improving: 0, stable: 0, degrading: 0 };
  for (const m of metrics) trendCounts[m.trend]++;
  const fleetTrend: 'improving' | 'stable' | 'degrading' =
    trendCounts.improving > trendCounts.degrading ? 'improving' :
    trendCounts.degrading > trendCounts.improving ? 'degrading' : 'stable';

  return {
    metrics,
    coherenceScore: fleetAvgCoherenceScore,
    incoherentResponses: totalIncoherent,
    contradictionCount: totalContradictions,
    reasoningGapCount: totalGaps,
    trend: fleetTrend,
    mostCoherentAgent: metrics[0]?.agentName ?? 'N/A',
    leastCoherentAgent: metrics[metrics.length - 1]?.agentName ?? 'N/A',
    fleetAvgCoherenceScore,
    lowCoherenceAgents: metrics.filter(m => m.coherenceScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
