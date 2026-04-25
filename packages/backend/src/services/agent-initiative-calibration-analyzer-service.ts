import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentInitiativeCalibrationAnalyzerMetric {
  agentId: string;
  agentName: string;
  calibrationScore: number;
  avgSessionDuration: number;
  durationVariance: number;
  overReachRate: number;
  underReachRate: number;
  trend: 'improving' | 'stable' | 'degrading';
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AgentInitiativeCalibrationAnalyzerReport {
  metrics: AgentInitiativeCalibrationAnalyzerMetric[];
  fleetAvgCalibrationScore: number;
  poorlyCalibrated: number;
  analysisTimestamp: string;
}

export async function analyzeAgentInitiativeCalibrationAnalyzer(): Promise<AgentInitiativeCalibrationAnalyzerReport> {
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

  const metrics: AgentInitiativeCalibrationAnalyzerMetric[] = [];

  for (const [agentId, agentSessions_] of agentMap.entries()) {
    const total = agentSessions_.length;
    if (total < 2) continue;

    const durations = agentSessions_.map(s => {
      const created = new Date(s.createdAt).getTime();
      const completed = s.completedAt ? new Date(s.completedAt).getTime() : created + 60000;
      return Math.max(0, completed - created);
    });

    const avgSessionDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    const variance = durations.reduce((acc, d) => acc + Math.pow(d - avgSessionDuration, 2), 0) / durations.length;
    const durationVariance = Math.sqrt(variance);

    const overReachRate = durations.filter(d => d > avgSessionDuration * 1.5).length / durations.length * 100;
    const underReachRate = durations.filter(d => d > 0 && d < avgSessionDuration * 0.5).length / durations.length * 100;

    const variancePenalty = Math.min(50, avgSessionDuration > 0 ? durationVariance / avgSessionDuration * 50 : 0);
    const calibrationScore = Math.max(0, Math.min(100, 100 - overReachRate * 0.3 - underReachRate * 0.3 - variancePenalty * 0.4));

    const recentDurations = durations.slice(0, Math.min(10, durations.length));
    const olderDurations = durations.slice(Math.min(10, durations.length), Math.min(20, durations.length));

    let trend: AgentInitiativeCalibrationAnalyzerMetric['trend'] = 'stable';
    if (recentDurations.length > 0 && olderDurations.length > 0) {
      const recentVar = Math.sqrt(recentDurations.reduce((acc, d) => {
        const avg = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;
        return acc + Math.pow(d - avg, 2);
      }, 0) / recentDurations.length);
      const olderVar = Math.sqrt(olderDurations.reduce((acc, d) => {
        const avg = olderDurations.reduce((a, b) => a + b, 0) / olderDurations.length;
        return acc + Math.pow(d - avg, 2);
      }, 0) / olderDurations.length);
      if (recentVar < olderVar - 5000) {
        trend = 'improving';
      } else if (recentVar > olderVar + 5000) {
        trend = 'degrading';
      }
    }

    const rating: AgentInitiativeCalibrationAnalyzerMetric['rating'] =
      calibrationScore >= 80 ? 'excellent' :
      calibrationScore >= 60 ? 'good' :
      calibrationScore >= 40 ? 'fair' : 'poor';

    metrics.push({
      agentId,
      agentName: (agentSessions_[0] as any)?.agentName ?? `Agent ${agentId.slice(0, 8)}`,
      calibrationScore: Math.round(calibrationScore * 10) / 10,
      avgSessionDuration: Math.round(avgSessionDuration),
      durationVariance: Math.round(durationVariance),
      overReachRate: Math.round(overReachRate * 10) / 10,
      underReachRate: Math.round(underReachRate * 10) / 10,
      trend,
      rating,
    });
  }

  metrics.sort((a, b) => b.calibrationScore - a.calibrationScore);

  const fleetAvgCalibrationScore = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.calibrationScore, 0) / metrics.length)
    : 0;

  return {
    metrics,
    fleetAvgCalibrationScore,
    poorlyCalibrated: metrics.filter(m => m.calibrationScore < 50).length,
    analysisTimestamp: new Date().toISOString(),
  };
}
