import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentTaskAbandonmentRateAnalyzerReport {
  abandonment_rate: number;
  escalation_rate: number;
  total_tasks: number;
  abandoned_tasks: number;
  graceful_escalations: number;
  silent_abandonments: number;
  top_abandonment_reasons: string[];
  avg_completion_depth_before_abandon: number;
  trend: 'improving' | 'stable' | 'degrading';
  highest_abandonment_agent: string;
  lowest_abandonment_agent: string;
  analysis_timestamp: string;
}

function computeCompletionDepth(session: { startedAt: string | null; completedAt: string | null }): number {
  const dur = session.completedAt && session.startedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 0;
  return Math.min(1.0, dur / 120000);
}

function isGracefulEscalation(session: { status: string; startedAt: string | null; completedAt: string | null }): boolean {
  const dur = session.completedAt && session.startedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 60000;
  return session.status === 'failed' && dur < 30000;
}

function isSilentAbandonment(session: { status: string; startedAt: string | null; completedAt: string | null }): boolean {
  const dur = session.completedAt && session.startedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : 60000;
  return session.status === 'failed' && dur >= 30000;
}

export async function analyzeAgentTaskAbandonmentRateAnalyzer(): Promise<AgentTaskAbandonmentRateAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      abandonment_rate: 0,
      escalation_rate: 0,
      total_tasks: 0,
      abandoned_tasks: 0,
      graceful_escalations: 0,
      silent_abandonments: 0,
      top_abandonment_reasons: [],
      avg_completion_depth_before_abandon: 0,
      trend: 'stable',
      highest_abandonment_agent: '',
      lowest_abandonment_agent: '',
      analysis_timestamp: new Date().toISOString(),
    };
  }

  const agentMap = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = session.agentId ?? session.id;
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(session);
  }

  const agentAbandonRates: { agentId: string; abandonRate: number }[] = [];

  let totalGraceful = 0;
  let totalSilent = 0;
  let totalDepth = 0;
  let depthCount = 0;

  for (const [agentId, agentSess] of agentMap) {
    let agentSilent = 0;
    for (const s of agentSess) {
      if (isGracefulEscalation(s)) {
        totalGraceful++;
      } else if (isSilentAbandonment(s)) {
        totalSilent++;
        agentSilent++;
        totalDepth += computeCompletionDepth(s);
        depthCount++;
      }
    }
    agentAbandonRates.push({
      agentId,
      abandonRate: agentSess.length > 0 ? agentSilent / agentSess.length : 0,
    });
  }

  const total = sessions.length;
  const abandonmentRate = Math.round((totalSilent / total) * 100);
  const escalationRate = Math.round((totalGraceful / total) * 100);
  const avgDepth = depthCount > 0 ? Math.round((totalDepth / depthCount) * 100) / 100 : 0;

  const reasons: string[] = [];
  if (totalSilent > 0) {
    if (totalSilent / total > 0.3) reasons.push('High complexity tasks');
    if (totalSilent / total > 0.1) reasons.push('Unclear instructions');
    reasons.push('Resource exhaustion');
    if (reasons.length < 3) reasons.push('Capability boundary exceeded');
  }

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentAbandoned = recent.filter(s => isSilentAbandonment(s)).length / Math.max(recent.length, 1);
  const olderAbandoned = older.filter(s => isSilentAbandonment(s)).length / Math.max(older.length, 1);
  const trend: 'improving' | 'stable' | 'degrading' =
    recentAbandoned < olderAbandoned - 0.05 ? 'improving' :
    recentAbandoned > olderAbandoned + 0.05 ? 'degrading' : 'stable';

  agentAbandonRates.sort((a, b) => b.abandonRate - a.abandonRate);
  const highestAbandonment = agentAbandonRates[0]?.agentId ?? '';
  const lowestAbandonment = agentAbandonRates[agentAbandonRates.length - 1]?.agentId ?? '';

  return {
    abandonment_rate: abandonmentRate,
    escalation_rate: escalationRate,
    total_tasks: total,
    abandoned_tasks: totalSilent + totalGraceful,
    graceful_escalations: totalGraceful,
    silent_abandonments: totalSilent,
    top_abandonment_reasons: reasons,
    avg_completion_depth_before_abandon: avgDepth,
    trend,
    highest_abandonment_agent: highestAbandonment,
    lowest_abandonment_agent: lowestAbandonment,
    analysis_timestamp: new Date().toISOString(),
  };
}
