import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentHallucinationRateAnalyzerMetric {
  agentId: string;
  agentName: string;
  estimatedHallucinationRate: number;
  correctionFrequency: number;
  contextAdherenceScore: number;
  reliabilityScore: number;
  totalSessions: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentHallucinationRateAnalyzerReport {
  metrics: AgentHallucinationRateAnalyzerMetric[];
  fleetAvgReliabilityScore: number;
  highRiskAgents: number;
  analysisTimestamp: string;
}

export async function analyzeAgentHallucinationRateAnalyzer(): Promise<AgentHallucinationRateAnalyzerReport> {
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

  const metrics: AgentHallucinationRateAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const sorted = [...agentSessions_].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const errorSessions = sorted.filter(s => s.status === 'error').length;
    const retryTotal = sorted.reduce((sum, s) => sum + (s.retryCount ?? 0), 0);

    // Hallucination proxy: retry count + error rate
    const estimatedHallucinationRate = Math.round(
      Math.min(100, ((errorSessions / total) * 50 + Math.min(50, retryTotal / total * 25))) * 10
    ) / 10;

    const correctionFrequency = Math.round((retryTotal / total) * 100 * 10) / 10;

    // Context adherence: inverse of hallucination rate
    const contextAdherenceScore = Math.min(100, Math.max(0, Math.round(100 - estimatedHallucinationRate)));

    const reliabilityScore = Math.min(100, Math.max(0, Math.round(
      contextAdherenceScore * 0.6 +
      Math.max(0, 100 - correctionFrequency) * 0.4
    )));

    const recent = sorted.slice(-10);
    const older = sorted.slice(-20, -10);
    const recentErrors = recent.filter(s => s.status === 'error').length / Math.max(1, recent.length);
    const olderErrors = older.filter(s => s.status === 'error').length / Math.max(1, older.length);
    const trend: AgentHallucinationRateAnalyzerMetric['trend'] =
      recentErrors < olderErrors - 0.05 ? 'improving' :
      recentErrors > olderErrors + 0.05 ? 'degrading' : 'stable';

    const rating: AgentHallucinationRateAnalyzerMetric['rating'] =
      reliabilityScore >= 80 ? 'excellent' :
      reliabilityScore >= 60 ? 'good' :
      reliabilityScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      estimatedHallucinationRate,
      correctionFrequency,
      contextAdherenceScore,
      reliabilityScore,
      totalSessions: total,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  const fleetAvgReliabilityScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.reliabilityScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgReliabilityScore,
    highRiskAgents: metrics.filter(m => m.reliabilityScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
