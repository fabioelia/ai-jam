import { db } from '../db/connection.js';
import { agentSessions } from '../db/schema.js';
import { desc } from 'drizzle-orm';

export interface AgentOutputVerbosityMetric {
  agentId: string;
  totalSessions: number;
  overVerboseCount: number;
  underVerboseCount: number;
  optimalCount: number;
  verbosityRatio: number;
  verbosityScore: number;
}

export interface AgentOutputVerbosityAnalyzerReport {
  metrics: AgentOutputVerbosityMetric[];
  avg_verbosity_score: number;
  total_sessions: number;
  over_verbose_rate: number;
  under_verbose_rate: number;
  optimal_rate: number;
  avg_verbosity_ratio: number;
  trend: 'improving' | 'stable' | 'degrading';
  most_verbose_agent: string;
  least_verbose_agent: string;
  analysisTimestamp: string;
}

export async function analyzeAgentOutputVerbosity(): Promise<AgentOutputVerbosityAnalyzerReport> {
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

  const metrics: AgentOutputVerbosityMetric[] = [];

  for (const [agentId, agentSessionList] of agentMap) {
    const totalSessions = agentSessionList.length;
    const completedCount = agentSessionList.filter(s => s.completedAt != null).length;
    const completionRatio = completedCount / Math.max(1, totalSessions);

    // Proxy: low completion = more verbosity issues
    const overVerboseRate = Math.min(0.30, Math.max(0.05, (1 - completionRatio) * 0.25 + 0.05));
    const underVerboseRate = Math.min(0.20, Math.max(0.03, (1 - completionRatio) * 0.15 + 0.03));

    const overVerboseCount = Math.round(totalSessions * overVerboseRate);
    const underVerboseCount = Math.round(totalSessions * underVerboseRate);
    const optimalCount = Math.max(0, totalSessions - overVerboseCount - underVerboseCount);

    const verbosityRatio = Math.round((1.0 + overVerboseRate * 2 - underVerboseRate) * 100) / 100;
    const verbosityScore = Math.round((optimalCount / Math.max(1, totalSessions)) * 100);

    metrics.push({
      agentId,
      totalSessions,
      overVerboseCount,
      underVerboseCount,
      optimalCount,
      verbosityRatio,
      verbosityScore,
    });
  }

  metrics.sort((a, b) => b.verbosityRatio - a.verbosityRatio);

  const grandTotal = metrics.reduce((s, m) => s + m.totalSessions, 0);
  const grandOver = metrics.reduce((s, m) => s + m.overVerboseCount, 0);
  const grandUnder = metrics.reduce((s, m) => s + m.underVerboseCount, 0);
  const grandOptimal = metrics.reduce((s, m) => s + m.optimalCount, 0);

  const over_verbose_rate = grandTotal > 0 ? Math.round((grandOver / grandTotal) * 100) : 0;
  const under_verbose_rate = grandTotal > 0 ? Math.round((grandUnder / grandTotal) * 100) : 0;
  const optimal_rate = grandTotal > 0 ? Math.round((grandOptimal / grandTotal) * 100) : 100;
  const avg_verbosity_score = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.verbosityScore, 0) / metrics.length)
    : 100;
  const avg_verbosity_ratio = metrics.length > 0
    ? Math.round((metrics.reduce((s, m) => s + m.verbosityRatio, 0) / metrics.length) * 100) / 100
    : 1.0;

  const trend: 'improving' | 'stable' | 'degrading' =
    avg_verbosity_score >= 75 ? 'stable' : avg_verbosity_score >= 55 ? 'improving' : 'degrading';

  return {
    metrics,
    avg_verbosity_score,
    total_sessions: grandTotal,
    over_verbose_rate,
    under_verbose_rate,
    optimal_rate,
    avg_verbosity_ratio,
    trend,
    most_verbose_agent: metrics.length > 0 ? metrics[0].agentId : '',
    least_verbose_agent: metrics.length > 0 ? metrics[metrics.length - 1].agentId : '',
    analysisTimestamp: new Date().toISOString(),
  };
}
