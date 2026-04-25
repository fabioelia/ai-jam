import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentUncertaintyQuantificationAnalyzerReport {
  uncertainty_score: number;
  uncertainty_rate: number;
  appropriate_escalation_rate: number;
  overconfident_rate: number;
  under_expressed_rate: number;
  trend: 'improving' | 'stable' | 'degrading';
  most_uncertain_agent: string;
  least_uncertain_agent: string;
  total_sessions: number;
  analysis_timestamp: string;
}

export async function analyzeAgentUncertaintyQuantificationAnalyzer(): Promise<AgentUncertaintyQuantificationAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      uncertainty_score: 0,
      uncertainty_rate: 0,
      appropriate_escalation_rate: 0,
      overconfident_rate: 0,
      under_expressed_rate: 0,
      trend: 'stable',
      most_uncertain_agent: '',
      least_uncertain_agent: '',
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

  const agentScores: { agentId: string; uncertaintyRate: number }[] = [];

  let totalUncertain = 0;
  let totalEscalated = 0;
  let totalOverconfident = 0;
  let totalUnderExpressed = 0;

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const total = sorted.length;
    // Proxy: failed sessions where no retry = overconfident; sessions with retries = uncertainty expressed
    const failedSessions = sorted.filter(s => s.status === 'failed');
    const withRetries = sorted.filter(s =>
      s.status === 'failed' && sorted.some(
        s2 => s2.agentId === s.agentId &&
        new Date(s2.createdAt).getTime() > new Date(s.createdAt).getTime() &&
        new Date(s2.createdAt).getTime() - new Date(s.createdAt).getTime() < 3600000
      )
    );

    const uncertainSessions = withRetries.length + Math.floor(total * 0.3); // base uncertainty proxy
    const appropriate = Math.floor(withRetries.length * 0.8);
    const overconfident = failedSessions.length - withRetries.length;
    const underExpressed = Math.max(0, failedSessions.length - appropriate);

    totalUncertain += Math.min(uncertainSessions, total);
    totalEscalated += appropriate;
    totalOverconfident += Math.max(0, overconfident);
    totalUnderExpressed += Math.max(0, underExpressed);

    const rate = total > 0 ? Math.round((Math.min(uncertainSessions, total) / total) * 100) : 0;
    agentScores.push({ agentId, uncertaintyRate: rate });
  }

  const total = sessions.length;
  const uncertaintyRate = Math.round((totalUncertain / total) * 100);
  const appropriateEscalationRate = total > 0 ? Math.round((totalEscalated / total) * 100) : 0;
  const overconfidentRate = total > 0 ? Math.round((totalOverconfident / total) * 100) : 0;
  const underExpressedRate = total > 0 ? Math.round((totalUnderExpressed / total) * 100) : 0;

  const uncertaintyScore = Math.max(0, Math.min(100,
    uncertaintyRate * 0.4 + appropriateEscalationRate * 0.6 - overconfidentRate * 0.3
  ));

  // Trend via halves comparison
  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentFailed = recent.filter(s => s.status === 'failed').length / Math.max(recent.length, 1);
  const olderFailed = older.filter(s => s.status === 'failed').length / Math.max(older.length, 1);
  const trend: 'improving' | 'stable' | 'degrading' =
    recentFailed < olderFailed - 0.05 ? 'improving' :
    recentFailed > olderFailed + 0.05 ? 'degrading' : 'stable';

  agentScores.sort((a, b) => b.uncertaintyRate - a.uncertaintyRate);
  const mostUncertain = agentScores[0]?.agentId ?? '';
  const leastUncertain = agentScores[agentScores.length - 1]?.agentId ?? '';

  return {
    uncertainty_score: Math.round(uncertaintyScore),
    uncertainty_rate: uncertaintyRate,
    appropriate_escalation_rate: appropriateEscalationRate,
    overconfident_rate: overconfidentRate,
    under_expressed_rate: underExpressedRate,
    trend,
    most_uncertain_agent: mostUncertain,
    least_uncertain_agent: leastUncertain,
    total_sessions: total,
    analysis_timestamp: new Date().toISOString(),
  };
}
