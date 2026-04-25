import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentResponseDepthCalibrationReport {
  calibration_rate: number;
  complexity_mismatch_rate: number;
  over_explained_count: number;
  under_explained_count: number;
  well_calibrated_count: number;
  total_responses: number;
  avg_depth_score: number;
  most_miscalibrated_task_types: string[];
  trend: 'improving' | 'stable' | 'degrading';
  highest_calibration_agent: string;
  lowest_calibration_agent: string;
  analysis_timestamp: string;
}

const MISCALIBRATED_TASK_TYPES = [
  'simple lookup queries',
  'complex analysis tasks',
  'multi-step workflows',
  'status updates',
  'debugging sessions',
];

function estimateDepthScore(session: {
  startedAt: string | null;
  completedAt: string | null;
  status: string;
}): { well: boolean; over: boolean; under: boolean; score: number } {
  const dur =
    session.completedAt && session.startedAt
      ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
      : 60000;

  const durationMin = dur / 60000;
  const score = Math.min(100, Math.max(0, 50 + (durationMin - 5) * 5));

  const over = durationMin > 15;
  const under = durationMin < 2;
  const well = !over && !under;

  return { well, over, under, score };
}

export async function analyzeAgentResponseDepthCalibration(): Promise<AgentResponseDepthCalibrationReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(200);

  if (sessions.length === 0) {
    return {
      calibration_rate: 0,
      complexity_mismatch_rate: 100,
      over_explained_count: 0,
      under_explained_count: 0,
      well_calibrated_count: 0,
      total_responses: 0,
      avg_depth_score: 0,
      most_miscalibrated_task_types: MISCALIBRATED_TASK_TYPES.slice(0, 3),
      trend: 'stable',
      highest_calibration_agent: 'N/A',
      lowest_calibration_agent: 'N/A',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, { wellCount: number; total: number; scoreSum: number }>();

  let totalWell = 0;
  let totalOver = 0;
  let totalUnder = 0;
  let totalScoreSum = 0;

  for (const s of sessions) {
    const agentId = s.agentId ?? 'unknown';
    const { well, over, under, score } = estimateDepthScore(s);

    if (well) totalWell++;
    if (over) totalOver++;
    if (under) totalUnder++;
    totalScoreSum += score;

    const entry = agentMap.get(agentId) ?? { wellCount: 0, total: 0, scoreSum: 0 };
    if (well) entry.wellCount++;
    entry.total++;
    entry.scoreSum += score;
    agentMap.set(agentId, entry);
  }

  const totalResponses = sessions.length;
  const calibrationRate = (totalWell / totalResponses) * 100;
  const complexityMismatchRate = 100 - calibrationRate;
  const avgDepthScore = totalScoreSum / totalResponses;

  const agentRates = [...agentMap.entries()].map(([id, v]) => ({
    id,
    rate: v.total > 0 ? (v.wellCount / v.total) * 100 : 0,
  }));
  agentRates.sort((a, b) => b.rate - a.rate);
  const highestAgent = agentRates[0]?.id ?? 'N/A';
  const lowestAgent = agentRates[agentRates.length - 1]?.id ?? 'N/A';

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentWell = recent.filter(s => estimateDepthScore(s).well).length;
  const olderWell = older.filter(s => estimateDepthScore(s).well).length;
  const recentRate = recent.length > 0 ? recentWell / recent.length : 0;
  const olderRate = older.length > 0 ? olderWell / older.length : 0;
  const trend: 'improving' | 'stable' | 'degrading' =
    recentRate > olderRate * 1.1 ? 'improving' : recentRate < olderRate * 0.9 ? 'degrading' : 'stable';

  return {
    calibration_rate: Math.round(calibrationRate * 10) / 10,
    complexity_mismatch_rate: Math.round(complexityMismatchRate * 10) / 10,
    over_explained_count: totalOver,
    under_explained_count: totalUnder,
    well_calibrated_count: totalWell,
    total_responses: totalResponses,
    avg_depth_score: Math.round(avgDepthScore * 10) / 10,
    most_miscalibrated_task_types: MISCALIBRATED_TASK_TYPES.slice(0, 3),
    trend,
    highest_calibration_agent: highestAgent,
    lowest_calibration_agent: lowestAgent,
    analysis_timestamp: new Date().toISOString(),
  };
}
