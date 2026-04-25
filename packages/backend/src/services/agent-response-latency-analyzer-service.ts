import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentResponseLatencyAnalyzerMetric {
  agentId: string;
  totalSessions: number;
  avgLatencyMs: number;
  fastSessions: number;
  normalSessions: number;
  slowSessions: number;
  verySlowSessions: number;
  fastRate: number;
  normalRate: number;
  slowRate: number;
  verySlowRate: number;
}

export interface AgentResponseLatencyAnalyzerReport {
  metrics: AgentResponseLatencyAnalyzerMetric[];
  avg_latency_ms: number;
  total_sessions: number;
  fast_rate: number;
  normal_rate: number;
  slow_rate: number;
  very_slow_rate: number;
  trend: 'improving' | 'stable' | 'degrading';
  fastest_agent: string;
  slowest_agent: string;
  analysisTimestamp: string;
}

export async function analyzeAgentResponseLatencyAnalyzer(): Promise<AgentResponseLatencyAnalyzerReport> {
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

  const metrics: AgentResponseLatencyAnalyzerMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const totalSessions = agentSessionList.length;

    // Use session duration as proxy for latency (ms). Completed sessions have real durations.
    const latencies = agentSessionList.map(s => {
      if (s.completedAt && s.startedAt) {
        return s.completedAt.getTime() - s.startedAt.getTime();
      }
      // Default proxy: 3s for sessions without timing data
      return 3000;
    });

    const avgLatencyMs = Math.round(latencies.reduce((s, v) => s + v, 0) / Math.max(1, latencies.length));

    const fastSessions = latencies.filter(l => l < 1000).length;
    const normalSessions = latencies.filter(l => l >= 1000 && l < 5000).length;
    const slowSessions = latencies.filter(l => l >= 5000 && l < 30000).length;
    const verySlowSessions = latencies.filter(l => l >= 30000).length;

    metrics.push({
      agentId,
      totalSessions,
      avgLatencyMs,
      fastSessions,
      normalSessions,
      slowSessions,
      verySlowSessions,
      fastRate: Math.round((fastSessions / Math.max(1, totalSessions)) * 100),
      normalRate: Math.round((normalSessions / Math.max(1, totalSessions)) * 100),
      slowRate: Math.round((slowSessions / Math.max(1, totalSessions)) * 100),
      verySlowRate: Math.round((verySlowSessions / Math.max(1, totalSessions)) * 100),
    });
  }

  metrics.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);

  const totalSessions = metrics.reduce((s, m) => s + m.totalSessions, 0);
  const allFast = metrics.reduce((s, m) => s + m.fastSessions, 0);
  const allNormal = metrics.reduce((s, m) => s + m.normalSessions, 0);
  const allSlow = metrics.reduce((s, m) => s + m.slowSessions, 0);
  const allVerySlow = metrics.reduce((s, m) => s + m.verySlowSessions, 0);

  const avgLatencyMs = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.avgLatencyMs, 0) / metrics.length)
    : 0;

  const fast_rate = totalSessions > 0 ? Math.round((allFast / totalSessions) * 100) : 0;
  const normal_rate = totalSessions > 0 ? Math.round((allNormal / totalSessions) * 100) : 0;
  const slow_rate = totalSessions > 0 ? Math.round((allSlow / totalSessions) * 100) : 0;
  const very_slow_rate = totalSessions > 0 ? Math.round((allVerySlow / totalSessions) * 100) : 0;

  const trend: 'improving' | 'stable' | 'degrading' =
    fast_rate >= 60 ? 'improving' : fast_rate >= 30 ? 'stable' : 'degrading';

  return {
    metrics,
    avg_latency_ms: avgLatencyMs,
    total_sessions: totalSessions,
    fast_rate,
    normal_rate,
    slow_rate,
    very_slow_rate,
    trend,
    fastest_agent: metrics.length > 0 ? metrics[0].agentId : '',
    slowest_agent: metrics.length > 0 ? metrics[metrics.length - 1].agentId : '',
    analysisTimestamp: new Date().toISOString(),
  };
}
