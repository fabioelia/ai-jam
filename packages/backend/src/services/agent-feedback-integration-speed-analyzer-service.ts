import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentFeedbackIntegrationSpeedAnalyzerMetric {
  agentId: string;
  agentName: string;
  avgIntegrationSpeedMs: number;
  feedbackResponseRate: number;
  repeatMistakeRate: number;
  integrationScore: number;
  totalFeedbackEvents: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentFeedbackIntegrationSpeedAnalyzerReport {
  metrics: AgentFeedbackIntegrationSpeedAnalyzerMetric[];
  fleetAvgIntegrationScore: number;
  slowLearners: number;
  analysisTimestamp: string;
}

export async function analyzeAgentFeedbackIntegrationSpeedAnalyzer(): Promise<AgentFeedbackIntegrationSpeedAnalyzerReport> {
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

  const metrics: AgentFeedbackIntegrationSpeedAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const errorSessions = agentSessions_.filter(s => s.status === 'error').length;
    const completedSessions = agentSessions_.filter(s => s.status === 'completed').length;

    // Compute durations from completedAt - startedAt
    const durationsMs: number[] = [];
    for (const s of agentSessions_) {
      if (s.completedAt && s.startedAt) {
        const dur = s.completedAt.getTime() - s.startedAt.getTime();
        if (dur >= 0) durationsMs.push(dur);
      }
    }

    const avgIntegrationSpeedMs = durationsMs.length > 0
      ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
      : 5000;

    const feedbackResponseRate = Math.max(0, ((completedSessions - errorSessions) / total) * 100);

    // Compute maxConsecutiveErrors
    let maxConsec = 0;
    let curConsec = 0;
    for (const s of agentSessions_) {
      if (s.status === 'error') {
        curConsec++;
        if (curConsec > maxConsec) maxConsec = curConsec;
      } else {
        curConsec = 0;
      }
    }
    const repeatMistakeRate = (maxConsec / total) * 100;

    const integrationScore =
      feedbackResponseRate * 0.5 +
      (100 - repeatMistakeRate) * 0.3 +
      Math.min(100, 10000 / Math.max(1, avgIntegrationSpeedMs)) * 0.2;

    // Trend: compare recent 10 vs older 10 sessions completion rate
    const recent = agentSessions_.slice(0, 10);
    const older = agentSessions_.slice(10, 20);
    const recentRate = recent.length > 0
      ? recent.filter(s => s.status === 'completed').length / recent.length
      : 0;
    const olderRate = older.length > 0
      ? older.filter(s => s.status === 'completed').length / older.length
      : recentRate;

    const trend: AgentFeedbackIntegrationSpeedAnalyzerMetric['trend'] =
      recentRate > olderRate + 0.05 ? 'improving' :
      recentRate < olderRate - 0.05 ? 'degrading' : 'stable';

    const rating: AgentFeedbackIntegrationSpeedAnalyzerMetric['rating'] =
      integrationScore >= 80 ? 'excellent' :
      integrationScore >= 60 ? 'good' :
      integrationScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      avgIntegrationSpeedMs,
      feedbackResponseRate: Math.round(feedbackResponseRate * 10) / 10,
      repeatMistakeRate: Math.round(repeatMistakeRate * 10) / 10,
      integrationScore: Math.round(integrationScore * 10) / 10,
      totalFeedbackEvents: total,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => a.integrationScore - b.integrationScore);

  const fleetAvgIntegrationScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.integrationScore, 0) / metrics.length * 10) / 10
    : 0;

  return {
    metrics,
    fleetAvgIntegrationScore,
    slowLearners: metrics.filter(m => m.integrationScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
