import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentResponseCalibrationDriftAnalyzerReport {
  drift_score: number;
  high_drift_rate: number;
  stable_rate: number;
  avg_drift: number;
  early_late_quality_delta: number;
  drift_acceleration_rate: number;
  trend: 'improving' | 'stable' | 'degrading';
  most_stable_agent: string;
  most_drifting_agent: string;
  total_sessions: number;
  analysis_timestamp: string;
}

export async function analyzeAgentResponseCalibrationDriftAnalyzer(): Promise<AgentResponseCalibrationDriftAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      drift_score: 0,
      high_drift_rate: 0,
      stable_rate: 0,
      avg_drift: 0,
      early_late_quality_delta: 0,
      drift_acceleration_rate: 0,
      trend: 'stable',
      most_stable_agent: '',
      most_drifting_agent: '',
      total_sessions: 0,
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agentDrifts: { agentId: string; avgDrift: number }[] = [];

  let totalHighDrift = 0;
  let totalStable = 0;
  let totalDriftSum = 0;
  let totalEarlyQuality = 0;
  let totalLateQuality = 0;
  let earlyLateCount = 0;
  let totalAcceleration = 0;

  for (const [agentId, agentSess] of agentMap) {
    if (agentSess.length < 2) {
      agentDrifts.push({ agentId, avgDrift: 0 });
      totalStable++;
      continue;
    }

    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Quality proxy: completed = 1, failed = 0, scaled by duration efficiency
    const qualities = sorted.map(s => {
      const success = s.status === 'completed' ? 1 : 0;
      const dur = s.completedAt && s.startedAt
        ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
        : 60000;
      const efficiency = Math.max(0, 1 - Math.min(dur / 600000, 1));
      return success * 0.7 + efficiency * 0.3;
    });

    // Drift = variance across sliding windows
    const windowSize = Math.max(2, Math.floor(qualities.length / 3));
    const windowAverages: number[] = [];
    for (let i = 0; i <= qualities.length - windowSize; i++) {
      const window = qualities.slice(i, i + windowSize);
      windowAverages.push(window.reduce((a, b) => a + b, 0) / windowSize);
    }

    let variance = 0;
    if (windowAverages.length > 1) {
      const mean = windowAverages.reduce((a, b) => a + b, 0) / windowAverages.length;
      variance = windowAverages.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / windowAverages.length;
    }

    const driftScore = Math.round(Math.min(variance * 400, 100));

    const earlyHalf = qualities.slice(0, Math.floor(qualities.length / 2));
    const lateHalf = qualities.slice(Math.floor(qualities.length / 2));
    const earlyQ = earlyHalf.reduce((a, b) => a + b, 0) / earlyHalf.length;
    const lateQ = lateHalf.reduce((a, b) => a + b, 0) / lateHalf.length;

    totalEarlyQuality += earlyQ;
    totalLateQuality += lateQ;
    earlyLateCount++;

    // Drift acceleration: compare first vs second half of windows
    let acceleration = 0;
    if (windowAverages.length >= 4) {
      const firstHalf = windowAverages.slice(0, Math.floor(windowAverages.length / 2));
      const secondHalf = windowAverages.slice(Math.floor(windowAverages.length / 2));
      const firstVar = firstHalf.reduce((s, v, _, arr) => {
        const m = arr.reduce((a, b) => a + b, 0) / arr.length;
        return s + Math.pow(v - m, 2);
      }, 0) / firstHalf.length;
      const secondVar = secondHalf.reduce((s, v, _, arr) => {
        const m = arr.reduce((a, b) => a + b, 0) / arr.length;
        return s + Math.pow(v - m, 2);
      }, 0) / secondHalf.length;
      acceleration = Math.round(Math.max(0, (secondVar - firstVar) * 400));
    }
    totalAcceleration += acceleration;

    if (driftScore >= 70) totalHighDrift++;
    if (driftScore < 30) totalStable++;
    totalDriftSum += driftScore;
    agentDrifts.push({ agentId, avgDrift: driftScore });
  }

  const numAgents = agentMap.size;
  const total = sessions.length;

  const avgDrift = numAgents > 0 ? Math.round(totalDriftSum / numAgents) : 0;
  const highDriftRate = numAgents > 0 ? Math.round((totalHighDrift / numAgents) * 100) : 0;
  const stableRate = numAgents > 0 ? Math.round((totalStable / numAgents) * 100) : 0;
  const earlyLateQualityDelta = earlyLateCount > 0
    ? Math.round(Math.abs((totalEarlyQuality / earlyLateCount) - (totalLateQuality / earlyLateCount)) * 100)
    : 0;
  const driftAccelerationRate = numAgents > 0 ? Math.round(totalAcceleration / numAgents) : 0;
  const driftScore = Math.max(0, Math.min(100, avgDrift));

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentCompleted = recent.filter(s => s.status === 'completed').length / Math.max(recent.length, 1);
  const olderCompleted = older.filter(s => s.status === 'completed').length / Math.max(older.length, 1);
  const trend: 'improving' | 'stable' | 'degrading' =
    recentCompleted > olderCompleted + 0.05 ? 'improving' :
    recentCompleted < olderCompleted - 0.05 ? 'degrading' : 'stable';

  agentDrifts.sort((a, b) => a.avgDrift - b.avgDrift);
  const mostStable = agentDrifts[0]?.agentId ?? '';
  const mostDrifting = agentDrifts[agentDrifts.length - 1]?.agentId ?? '';

  return {
    drift_score: driftScore,
    high_drift_rate: highDriftRate,
    stable_rate: stableRate,
    avg_drift: avgDrift,
    early_late_quality_delta: earlyLateQualityDelta,
    drift_acceleration_rate: driftAccelerationRate,
    trend,
    most_stable_agent: mostStable,
    most_drifting_agent: mostDrifting,
    total_sessions: total,
    analysis_timestamp: new Date().toISOString(),
  };
}
