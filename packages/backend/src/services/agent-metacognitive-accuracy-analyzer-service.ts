import { db } from '../db/connection';
import { agentSessions } from '../db/schema';
import { desc } from 'drizzle-orm';

export interface AgentMetacognitiveAccuracyAnalyzerReport {
  accuracy_score: number;
  overconfidence_rate: number;
  underconfidence_rate: number;
  escalation_accuracy_rate: number;
  capability_claim_accuracy_rate: number;
  trend: 'improving' | 'stable' | 'degrading';
  most_accurate_agent: string;
  least_accurate_agent: string;
  total_sessions: number;
  analysis_timestamp: string;
}

export async function analyzeAgentMetacognitiveAccuracyAnalyzer(): Promise<AgentMetacognitiveAccuracyAnalyzerReport> {
  const sessions = await db
    .select()
    .from(agentSessions)
    .orderBy(desc(agentSessions.createdAt))
    .limit(500);

  if (sessions.length === 0) {
    return {
      accuracy_score: 0,
      overconfidence_rate: 0,
      underconfidence_rate: 0,
      escalation_accuracy_rate: 0,
      capability_claim_accuracy_rate: 0,
      trend: 'stable',
      most_accurate_agent: '',
      least_accurate_agent: '',
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

  const agentAccuracies: { agentId: string; accuracyScore: number }[] = [];

  let totalAccurate = 0;
  let totalOverconfident = 0;
  let totalUnderconfident = 0;
  let totalEscalationAccurate = 0;
  let totalCapabilityAccurate = 0;

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let accurate = 0;
    let overconfident = 0;
    let underconfident = 0;
    let escalationAccurate = 0;
    let capabilityAccurate = 0;

    for (const s of sorted) {
      const completed = s.status === 'completed';
      const failed = s.status === 'failed';
      // Proxy: escalated = session has very short duration (gave up quickly)
      const dur = s.completedAt && s.startedAt
        ? new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
        : 60000;
      const escalated = dur < 30000; // <30s = escalated/deferred

      if (completed && !escalated) {
        accurate++;
        capabilityAccurate++;
        escalationAccurate++;
      } else if (failed && !escalated) {
        overconfident++; // claimed could do it but failed
        capabilityAccurate++; // at least tried
      } else if (escalated && completed) {
        underconfident++; // escalated but actually could have done it
        escalationAccurate++;
      } else if (escalated && failed) {
        accurate++; // correctly escalated
        escalationAccurate++;
      }
    }

    const total = sorted.length;
    const accuracyScore = total > 0 ? Math.round((accurate / total) * 100) : 0;
    totalAccurate += accurate;
    totalOverconfident += overconfident;
    totalUnderconfident += underconfident;
    totalEscalationAccurate += escalationAccurate;
    totalCapabilityAccurate += capabilityAccurate;

    agentAccuracies.push({ agentId, accuracyScore });
  }

  const total = sessions.length;
  const accuracyScore = total > 0 ? Math.round((totalAccurate / total) * 100) : 0;
  const overconfidenceRate = total > 0 ? Math.round((totalOverconfident / total) * 100) : 0;
  const underconfidenceRate = total > 0 ? Math.round((totalUnderconfident / total) * 100) : 0;
  const escalationAccuracyRate = total > 0 ? Math.round((totalEscalationAccurate / total) * 100) : 0;
  const capabilityClaimAccuracyRate = total > 0 ? Math.round((totalCapabilityAccurate / total) * 100) : 0;

  const half = Math.floor(sessions.length / 2);
  const recent = sessions.slice(0, half);
  const older = sessions.slice(half);
  const recentCompleted = recent.filter(s => s.status === 'completed').length / Math.max(recent.length, 1);
  const olderCompleted = older.filter(s => s.status === 'completed').length / Math.max(older.length, 1);
  const trend: 'improving' | 'stable' | 'degrading' =
    recentCompleted > olderCompleted + 0.05 ? 'improving' :
    recentCompleted < olderCompleted - 0.05 ? 'degrading' : 'stable';

  agentAccuracies.sort((a, b) => b.accuracyScore - a.accuracyScore);
  const mostAccurate = agentAccuracies[0]?.agentId ?? '';
  const leastAccurate = agentAccuracies[agentAccuracies.length - 1]?.agentId ?? '';

  return {
    accuracy_score: accuracyScore,
    overconfidence_rate: overconfidenceRate,
    underconfidence_rate: underconfidenceRate,
    escalation_accuracy_rate: escalationAccuracyRate,
    capability_claim_accuracy_rate: capabilityClaimAccuracyRate,
    trend,
    most_accurate_agent: mostAccurate,
    least_accurate_agent: leastAccurate,
    total_sessions: total,
    analysis_timestamp: new Date().toISOString(),
  };
}
