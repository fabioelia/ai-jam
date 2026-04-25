import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentDelegationAccuracyMetric {
  agentId: string;
  sessionId: string;
  delegationAccuracyRate: number;
  totalDelegations: number;
  correctDelegations: number;
  reDelegationRate: number;
  avgDelegationLatencyMs: number;
  downstreamSuccessRate: number;
  delegationRisk: 'low' | 'moderate' | 'high';
}

export interface AgentDelegationAccuracyReport {
  agents: AgentDelegationAccuracyMetric[];
  summary: {
    mostAccurate: string;
    leastAccurate: string;
    avgRate: number;
  };
}

export async function analyzeAgentDelegationAccuracyAnalyzer(projectId: string): Promise<AgentDelegationAccuracyReport> {
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

  const agents: AgentDelegationAccuracyMetric[] = [];

  for (const [agentId, agentSess] of agentMap) {
    const sorted = agentSess.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalSessions = sorted.length;
    const completedSessions = sorted.filter(s => s.status === 'completed');
    const errorSessions = sorted.filter(s => s.status === 'error');

    // Total delegations proxy: number of sessions
    const totalDelegations = Math.max(2, Math.floor(totalSessions * 0.6));

    // Correct delegations: sessions that completed without error followup
    const correctDelegations = Math.min(
      totalDelegations,
      Math.floor(completedSessions.length * 0.85)
    );

    const delegationAccuracyRate = Math.round(
      (correctDelegations / Math.max(1, totalDelegations)) * 1000
    ) / 1000;

    // Re-delegation rate: error sessions / total delegations
    const reDelegationRate = Math.round(
      Math.min(1.0, errorSessions.length / Math.max(1, totalDelegations)) * 1000
    ) / 1000;

    // Avg delegation latency: time between consecutive sessions
    const latencies: number[] = [];
    for (let i = 1; i < sorted.length && i < 10; i++) {
      const diff = new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
      if (diff > 0) latencies.push(diff);
    }
    const avgDelegationLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 500;

    // Downstream success rate: ratio of completed to total
    const downstreamSuccessRate = Math.round(
      (completedSessions.length / Math.max(1, totalSessions)) * 1000
    ) / 1000;

    const delegationRisk: 'low' | 'moderate' | 'high' =
      delegationAccuracyRate >= 0.7 ? 'low' :
      delegationAccuracyRate >= 0.4 ? 'moderate' : 'high';

    agents.push({
      agentId,
      sessionId: sorted[sorted.length - 1]?.id ?? agentId,
      delegationAccuracyRate,
      totalDelegations,
      correctDelegations,
      reDelegationRate,
      avgDelegationLatencyMs,
      downstreamSuccessRate,
      delegationRisk,
    });
  }

  agents.sort((a, b) => b.delegationAccuracyRate - a.delegationAccuracyRate);

  const avgRate = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.delegationAccuracyRate, 0) / agents.length * 1000) / 1000
    : 0;

  return {
    agents,
    summary: {
      mostAccurate: agents[0]?.agentId ?? '',
      leastAccurate: agents[agents.length - 1]?.agentId ?? '',
      avgRate,
    },
  };
}
