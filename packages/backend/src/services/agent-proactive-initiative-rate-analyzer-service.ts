import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentProactiveInitiativeRateAnalyzerMetric {
  agentId: string;
  agentName: string;
  initiativeRate: number;
  avgInitiativesPerSession: number;
  highValueInitiatives: number;
  initiativeScore: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentProactiveInitiativeRateAnalyzerReport {
  metrics: AgentProactiveInitiativeRateAnalyzerMetric[];
  fleetAvgInitiativeScore: number;
  reactiveAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentProactiveInitiativeRateAnalyzer(): Promise<AgentProactiveInitiativeRateAnalyzerReport> {
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

  const metrics: AgentProactiveInitiativeRateAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const sorted = agentSessionList.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const completedSessions = sorted.filter(s => s.status === 'completed').length;

    const durations = sorted
      .filter(s => s.completedAt != null && s.startedAt != null)
      .map(s => new Date(s.completedAt!).getTime() - new Date(s.startedAt!).getTime())
      .filter(d => d > 0);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const initiativeSessions = durations.filter(d => d < avgDuration * 0.8).length;
    const initiativeRate = totalSessions > 0 ? (initiativeSessions / totalSessions) * 100 : 0;
    const avgInitiativesPerSession = totalSessions > 0 ? initiativeSessions / totalSessions : 0;

    const highValueInitiatives = sorted.filter(s => {
      if (s.status !== 'completed' || s.completedAt == null || s.startedAt == null) return false;
      const dur = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
      return dur > 0 && dur < avgDuration * 0.8;
    }).length;

    const initiativeScore = Math.min(100, Math.max(0,
      initiativeRate * 0.4 +
      (completedSessions / Math.max(1, totalSessions)) * 100 * 0.4 +
      Math.min(100, (highValueInitiatives / Math.max(1, totalSessions)) * 100) * 0.2
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentScore = recent.filter(s => s.status === 'completed').length / Math.max(1, recent.length) * 100;
    const olderScore = older.filter(s => s.status === 'completed').length / Math.max(1, older.length) * 100;
    const trend: 'improving' | 'stable' | 'degrading' = recentScore > olderScore + 5 ? 'improving' : recentScore < olderScore - 5 ? 'degrading' : 'stable';

    const rating: 'excellent' | 'good' | 'fair' | 'poor' = initiativeScore >= 80 ? 'excellent' : initiativeScore >= 60 ? 'good' : initiativeScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      initiativeRate: Math.round(initiativeRate * 10) / 10,
      avgInitiativesPerSession: Math.round(avgInitiativesPerSession * 100) / 100,
      highValueInitiatives,
      initiativeScore: Math.round(initiativeScore),
      totalSessions,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.initiativeScore - a.initiativeScore);

  const fleetAvgInitiativeScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.initiativeScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgInitiativeScore,
    reactiveAgents: metrics.filter(m => m.initiativeScore < 40).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
