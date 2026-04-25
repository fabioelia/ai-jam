import Anthropic from '@anthropic-ai/sdk';

export interface AgentLearningMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  totalSessions: number;
  earlyCompletionRate: number;
  recentCompletionRate: number;
  completionRateDelta: number;
  earlyAvgDurationMs: number;
  recentAvgDurationMs: number;
  durationDeltaMs: number;
  learningScore: number;
  learningTier: 'accelerating' | 'improving' | 'stable' | 'declining';
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}

export interface AgentLearningCurveReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgLearningScore: number;
    improvingCount: number;
    decliningCount: number;
    stableCount: number;
  };
  agents: AgentLearningMetrics[];
  aiSummary: string;
  aiRecommendations: string[];
}

export function computeLearningScore(
  completionRateDelta: number,
  durationDeltaMs: number,
  totalSessions: number,
): number {
  const completionComponent = Math.min(50, Math.max(-50, completionRateDelta * 100));
  const speedComponent =
    durationDeltaMs > 0
      ? Math.min(30, Math.max(0, durationDeltaMs / 60000))
      : Math.min(0, Math.max(-30, durationDeltaMs / 60000));
  const volumeBonus = totalSessions >= 20 ? 20 : totalSessions >= 10 ? 10 : 0;
  const raw = 50 + completionComponent + speedComponent + volumeBonus;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function getLearningTier(
  score: number,
): 'accelerating' | 'improving' | 'stable' | 'declining' {
  if (score >= 80) return 'accelerating';
  if (score >= 60) return 'improving';
  if (score >= 40) return 'stable';
  return 'declining';
}

export function getTrend(
  completionRateDelta: number,
  durationDeltaMs: number,
): 'improving' | 'declining' | 'stable' {
  if (completionRateDelta > 0.05 || durationDeltaMs > 30000) return 'improving';
  if (completionRateDelta < -0.05 || durationDeltaMs < -30000) return 'declining';
  return 'stable';
}

interface MockSession {
  status: string;
  durationMs: number | null;
}

function buildMetrics(
  agentId: string,
  agentName: string,
  agentRole: string,
  sessions: MockSession[],
): AgentLearningMetrics {
  const total = sessions.length;

  if (total < 4) {
    return {
      agentId,
      agentName,
      agentRole,
      totalSessions: total,
      earlyCompletionRate: 0,
      recentCompletionRate: 0,
      completionRateDelta: 0,
      earlyAvgDurationMs: 0,
      recentAvgDurationMs: 0,
      durationDeltaMs: 0,
      learningScore: 0,
      learningTier: 'declining',
      trend: 'insufficient_data',
    };
  }

  const bucketSize = Math.floor(total * 0.3);
  const early = sessions.slice(0, bucketSize);
  const recent = sessions.slice(total - bucketSize);

  const completionRate = (bucket: MockSession[]) =>
    bucket.filter((s) => s.status === 'completed').length / bucket.length;

  const avgDuration = (bucket: MockSession[]) => {
    const valid = bucket.map((s) => s.durationMs).filter((d): d is number => d !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };

  const earlyCompletionRate = completionRate(early);
  const recentCompletionRate = completionRate(recent);
  const completionRateDelta = recentCompletionRate - earlyCompletionRate;
  const earlyAvgDurationMs = avgDuration(early);
  const recentAvgDurationMs = avgDuration(recent);
  const durationDeltaMs = earlyAvgDurationMs - recentAvgDurationMs;

  const learningScore = computeLearningScore(completionRateDelta, durationDeltaMs, total);

  return {
    agentId,
    agentName,
    agentRole,
    totalSessions: total,
    earlyCompletionRate,
    recentCompletionRate,
    completionRateDelta,
    earlyAvgDurationMs,
    recentAvgDurationMs,
    durationDeltaMs,
    learningScore,
    learningTier: getLearningTier(learningScore),
    trend: getTrend(completionRateDelta, durationDeltaMs),
  };
}

export async function analyzeAgentLearningCurve(
  projectId: string,
): Promise<AgentLearningCurveReport> {
  const mockAgentData = [
    {
      name: 'Backend Developer',
      role: 'Backend Developer',
      sessions: [
        ...Array(4).fill({ status: 'completed', durationMs: 7200000 }),
        ...Array(3).fill({ status: 'failed', durationMs: 5400000 }),
        ...Array(4).fill({ status: 'completed', durationMs: 4800000 }),
        ...Array(3).fill({ status: 'completed', durationMs: 3600000 }),
      ],
    },
    {
      name: 'Frontend Developer',
      role: 'Frontend Developer',
      sessions: [
        ...Array(3).fill({ status: 'completed', durationMs: 5400000 }),
        ...Array(4).fill({ status: 'failed', durationMs: 6000000 }),
        ...Array(3).fill({ status: 'completed', durationMs: 4200000 }),
        ...Array(5).fill({ status: 'completed', durationMs: 3000000 }),
      ],
    },
    {
      name: 'QA Engineer',
      role: 'QA Engineer',
      sessions: [
        ...Array(5).fill({ status: 'completed', durationMs: 3600000 }),
        ...Array(3).fill({ status: 'completed', durationMs: 3400000 }),
        ...Array(3).fill({ status: 'failed', durationMs: 4800000 }),
        ...Array(4).fill({ status: 'failed', durationMs: 5400000 }),
      ],
    },
    {
      name: 'DevOps Engineer',
      role: 'DevOps Engineer',
      sessions: [
        ...Array(4).fill({ status: 'completed', durationMs: 4800000 }),
        ...Array(4).fill({ status: 'completed', durationMs: 4600000 }),
        ...Array(3).fill({ status: 'completed', durationMs: 4400000 }),
        ...Array(4).fill({ status: 'completed', durationMs: 4200000 }),
      ],
    },
  ];

  const agents: AgentLearningMetrics[] = mockAgentData.map((a, i) =>
    buildMetrics(`agent-${i + 1}`, a.name, a.role, a.sessions),
  );

  agents.sort((a, b) => b.learningScore - a.learningScore);

  const avgLearningScore =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.learningScore, 0) / agents.length)
      : 0;
  const improvingCount = agents.filter((a) => a.trend === 'improving').length;
  const decliningCount = agents.filter((a) => a.trend === 'declining').length;
  const stableCount = agents.filter(
    (a) => a.trend === 'stable' || a.trend === 'insufficient_data',
  ).length;

  let aiSummary = 'Learning curve analysis complete.';
  let aiRecommendations: string[] = [
    'Provide additional training resources for agents with declining trends.',
    'Pair high-performing accelerating agents with declining ones for mentorship.',
    'Review task assignment patterns for agents showing insufficient data.',
  ];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Analyze agent learning curves: ${agents.length} agents, avg score ${avgLearningScore}, ${improvingCount} improving, ${decliningCount} declining. Provide a 2-sentence summary and 3 recommendations.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.summary) aiSummary = parsed.summary;
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          aiRecommendations = parsed.recommendations;
        }
      } catch {
        const lines = text.split('\n').filter((l) => l.trim());
        aiSummary = lines[0] ?? aiSummary;
        aiRecommendations =
          lines.slice(1, 4).filter(Boolean).length > 0
            ? lines.slice(1, 4).filter(Boolean)
            : aiRecommendations;
      }
    }
  } catch (e) {
    console.warn('AI learning curve analysis failed, using fallback:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgLearningScore,
      improvingCount,
      decliningCount,
      stableCount,
    },
    agents,
    aiSummary,
    aiRecommendations,
  };
}
