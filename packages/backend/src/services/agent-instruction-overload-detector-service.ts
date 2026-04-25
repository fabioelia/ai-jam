import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentInstructionOverloadDetectorReport {
  overload_score: number;
  avg_instructions_per_session: number;
  overloaded_sessions: number;
  total_sessions: number;
  overload_threshold: number;
  performance_degradation_rate: number;
  error_rate_under_overload: number;
  error_rate_normal: number;
  optimal_instruction_range: { min: number; max: number };
  trend: 'improving' | 'stable' | 'degrading';
  most_overloaded_agent: string;
  least_overloaded_agent: string;
  analysis_timestamp: string;
}

const OVERLOAD_THRESHOLD = 20;

function estimateInstructionCount(session: { startedAt: string | null; completedAt: string | null }): number {
  const dur = session.completedAt && session.startedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 60000;
  return Math.max(1, Math.round(dur / 5000));
}

export async function analyzeAgentInstructionOverloadDetector(): Promise<AgentInstructionOverloadDetectorReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      overload_score: 0,
      avg_instructions_per_session: 0,
      overloaded_sessions: 0,
      total_sessions: 0,
      overload_threshold: OVERLOAD_THRESHOLD,
      performance_degradation_rate: 0,
      error_rate_under_overload: 0,
      error_rate_normal: 0,
      optimal_instruction_range: { min: 5, max: OVERLOAD_THRESHOLD },
      trend: 'stable',
      most_overloaded_agent: '',
      least_overloaded_agent: '',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agentOverloads: { agentId: string; overloadRate: number }[] = [];

  let totalInstructions = 0;
  let totalOverloaded = 0;
  let totalFailedOverload = 0;
  let totalOverloadSessions = 0;
  let totalFailedNormal = 0;
  let totalNormalSessions = 0;

  for (const [agentId, agentSess] of agentMap) {
    let agentOverloaded = 0;
    for (const s of agentSess) {
      const instructions = estimateInstructionCount(s);
      totalInstructions += instructions;
      if (instructions > OVERLOAD_THRESHOLD) {
        agentOverloaded++;
        totalOverloaded++;
        totalOverloadSessions++;
        if (s.status === 'failed') totalFailedOverload++;
      } else {
        totalNormalSessions++;
        if (s.status === 'failed') totalFailedNormal++;
      }
    }
    agentOverloads.push({
      agentId,
      overloadRate: agentSess.length > 0 ? agentOverloaded / agentSess.length : 0,
    });
  }

  const total = sessions.length;
  const overloadScore = Math.round((totalOverloaded / total) * 100);
  const avgInstructions = Math.round(totalInstructions / total);

  const errorRateUnderOverload = totalOverloadSessions > 0
    ? Math.round((totalFailedOverload / totalOverloadSessions) * 100) : 0;
  const errorRateNormal = totalNormalSessions > 0
    ? Math.round((totalFailedNormal / totalNormalSessions) * 100) : 0;
  const performanceDegradationRate = Math.max(0, errorRateUnderOverload - errorRateNormal);

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentOverload = recent.filter(s => estimateInstructionCount(s) > OVERLOAD_THRESHOLD).length / Math.max(recent.length, 1);
  const olderOverload = older.filter(s => estimateInstructionCount(s) > OVERLOAD_THRESHOLD).length / Math.max(older.length, 1);
  const trend: 'improving' | 'stable' | 'degrading' =
    recentOverload < olderOverload - 0.05 ? 'improving' :
    recentOverload > olderOverload + 0.05 ? 'degrading' : 'stable';

  agentOverloads.sort((a, b) => b.overloadRate - a.overloadRate);
  const mostOverloaded = agentOverloads[0]?.agentId ?? '';
  const leastOverloaded = agentOverloads[agentOverloads.length - 1]?.agentId ?? '';

  return {
    overload_score: overloadScore,
    avg_instructions_per_session: avgInstructions,
    overloaded_sessions: totalOverloaded,
    total_sessions: total,
    overload_threshold: OVERLOAD_THRESHOLD,
    performance_degradation_rate: performanceDegradationRate,
    error_rate_under_overload: errorRateUnderOverload,
    error_rate_normal: errorRateNormal,
    optimal_instruction_range: { min: 5, max: OVERLOAD_THRESHOLD },
    trend,
    most_overloaded_agent: mostOverloaded,
    least_overloaded_agent: leastOverloaded,
    analysis_timestamp: new Date().toISOString(),
  };
}
