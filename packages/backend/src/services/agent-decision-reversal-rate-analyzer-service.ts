import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentDecisionReversalRateAnalyzerMetric {
  agentId: string;
  agentName: string;
  reversalRate: number;
  totalReversals: number;
  avgReversalsPerSession: number;
  abandonmentRate: number;
  stabilityScore: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentDecisionReversalRateAnalyzerReport {
  metrics: AgentDecisionReversalRateAnalyzerMetric[];
  fleetAvgStabilityScore: number;
  highReversalAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentDecisionReversalRateAnalyzer(): Promise<AgentDecisionReversalRateAnalyzerReport> {
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

  const metrics: AgentDecisionReversalRateAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const sorted = agentSessionList.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;

    let reversals = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      const gap = new Date(next.createdAt).getTime() - new Date(curr.createdAt).getTime();
      if (curr.status === 'error' && gap < 300000) {
        reversals++;
      }
      if (curr.status === 'interrupted' && gap < 120000) {
        reversals++;
      }
    }

    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const interruptedSessions = sorted.filter(s => s.status === 'interrupted').length;
    const abandonmentRate = totalSessions > 0
      ? ((errorSessions + interruptedSessions) / totalSessions) * 100
      : 0;

    const reversalRate = totalSessions > 0
      ? Math.min(100, (reversals / totalSessions) * 100)
      : 0;

    const avgReversalsPerSession = totalSessions > 0
      ? Math.round((reversals / totalSessions) * 100) / 100
      : 0;

    const stabilityScore = Math.min(100, Math.max(0,
      (100 - reversalRate) * 0.6 +
      (100 - abandonmentRate) * 0.4
    ));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentReversalRate = recent.filter(s => s.status === 'error' || s.status === 'interrupted').length / Math.max(1, recent.length) * 100;
    const olderReversalRate = older.filter(s => s.status === 'error' || s.status === 'interrupted').length / Math.max(1, older.length) * 100;
    const trend = recentReversalRate < olderReversalRate - 5 ? 'improving' : recentReversalRate > olderReversalRate + 5 ? 'degrading' : 'stable';

    const rating = stabilityScore >= 80 ? 'excellent' : stabilityScore >= 60 ? 'good' : stabilityScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: agentId,
      reversalRate: Math.round(reversalRate * 10) / 10,
      totalReversals: reversals,
      avgReversalsPerSession,
      abandonmentRate: Math.round(abandonmentRate * 10) / 10,
      stabilityScore: Math.round(stabilityScore),
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.stabilityScore - a.stabilityScore);

  const fleetAvgStabilityScore = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.stabilityScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgStabilityScore,
    highReversalAgents: metrics.filter(m => m.reversalRate > 30).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
