import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull, gte } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentTrendMetrics {
  completionRate: number;
  stallRate: number;
  avgResolutionDays: number;
  ticketVolume: number;
}

export interface AgentPerformanceTrend {
  agentName: string;
  recent: AgentTrendMetrics;
  baseline: AgentTrendMetrics;
  trendDirection: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  completionRateDelta: number;
  stallRateDelta: number;
  recommendation: string;
}

export interface PerformanceTrendReport {
  projectId: string;
  analyzedAt: string;
  windowDays: number;
  totalAgents: number;
  improvingAgents: number;
  decliningAgents: number;
  stableAgents: number;
  agentTrends: AgentPerformanceTrend[];
  aiSummary: string;
}

const FALLBACK_REC = 'Monitor this agent closely and review ticket assignments for the next sprint.';
const FALLBACK_SUMMARY = 'Review declining agents and consider redistributing tickets to high-performers.';

const TREND_ORDER: Record<string, number> = {
  declining: 0,
  insufficient_data: 1,
  stable: 2,
  improving: 3,
};

type TicketRow = { status: string; updatedAt: Date | null; createdAt: Date | null };

function computeMetrics(ts: TicketRow[], staleThreshold: Date): AgentTrendMetrics {
  const totalTickets = ts.length;
  if (totalTickets === 0) {
    return { completionRate: 0, stallRate: 0, avgResolutionDays: 0, ticketVolume: 0 };
  }
  const completedTickets = ts.filter((t) => t.status === 'done').length;
  const stalledTickets = ts.filter((t) => {
    if (t.status === 'done' || t.status === 'cancelled') return false;
    const updated = t.updatedAt ? new Date(t.updatedAt) : null;
    return updated ? updated < staleThreshold : false;
  }).length;

  const doneTimes = ts
    .filter((t) => t.status === 'done' && t.updatedAt && t.createdAt)
    .map((t) => {
      const days =
        (new Date(t.updatedAt!).getTime() - new Date(t.createdAt!).getTime()) /
        (1000 * 60 * 60 * 24);
      return Math.max(0, days);
    });
  const avgResolutionDays =
    doneTimes.length > 0
      ? Math.round((doneTimes.reduce((a, b) => a + b, 0) / doneTimes.length) * 100) / 100
      : 0;

  return {
    completionRate: Math.round((completedTickets / totalTickets) * 1000) / 1000,
    stallRate: Math.round((stalledTickets / totalTickets) * 1000) / 1000,
    avgResolutionDays,
    ticketVolume: totalTickets,
  };
}

function determineTrend(
  recent: AgentTrendMetrics,
  baseline: AgentTrendMetrics,
  completionRateDelta: number,
  stallRateDelta: number,
): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
  if (recent.ticketVolume < 2 || baseline.ticketVolume < 2) return 'insufficient_data';
  if (completionRateDelta >= 0.1 || stallRateDelta <= -0.1) return 'improving';
  if (completionRateDelta <= -0.1 || stallRateDelta >= 0.1) return 'declining';
  return 'stable';
}

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  return text;
}

export async function analyzePerformanceTrends(projectId: string): Promise<PerformanceTrendReport> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const allTickets = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        isNotNull(tickets.assignedPersona),
        gte(tickets.updatedAt, thirtyDaysAgo),
      ),
    );

  if (allTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      windowDays: 30,
      totalAgents: 0,
      improvingAgents: 0,
      decliningAgents: 0,
      stableAgents: 0,
      agentTrends: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const agentMap = new Map<string, TicketRow[]>();
  for (const t of allTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push({ status: t.status, updatedAt: t.updatedAt, createdAt: t.createdAt });
  }

  type RawTrend = Omit<AgentPerformanceTrend, 'recommendation'>;
  const rawTrends: RawTrend[] = [];

  for (const [agentName, ts] of agentMap.entries()) {
    const recentTickets = ts.filter((t) => {
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      return updated ? updated >= sevenDaysAgo : false;
    });
    const baselineTickets = ts.filter((t) => {
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      return updated ? updated >= thirtyDaysAgo && updated < sevenDaysAgo : false;
    });

    const recent = computeMetrics(recentTickets, staleThreshold);
    const baseline = computeMetrics(baselineTickets, staleThreshold);

    const completionRateDelta =
      Math.round((recent.completionRate - baseline.completionRate) * 1000) / 1000;
    const stallRateDelta =
      Math.round((recent.stallRate - baseline.stallRate) * 1000) / 1000;

    const trendDirection = determineTrend(recent, baseline, completionRateDelta, stallRateDelta);

    rawTrends.push({ agentName, recent, baseline, trendDirection, completionRateDelta, stallRateDelta });
  }

  rawTrends.sort((a, b) => {
    const td = TREND_ORDER[a.trendDirection] - TREND_ORDER[b.trendDirection];
    return td !== 0 ? td : a.agentName.localeCompare(b.agentName);
  });

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < rawTrends.length; i += 4) {
    const batch = rawTrends.slice(i, i + 4);
    try {
      const desc = batch
        .map(
          (t) =>
            `Agent: ${t.agentName}, Trend: ${t.trendDirection}, CompletionDelta: ${(t.completionRateDelta * 100).toFixed(1)}%, StallDelta: ${(t.stallRateDelta * 100).toFixed(1)}%, RecentVolume: ${t.recent.ticketVolume}, BaselineVolume: ${t.baseline.ticketVolume}`,
        )
        .join('\n');
      const prompt = `For each agent below, write exactly one sentence with a trend-specific action to take. Output as JSON array [{agentName, recommendation}].\n\n${desc}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonStr = extractJSONFromText(text);
      const parsed = JSON.parse(jsonStr) as Array<{ agentName: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.agentName && item.recommendation) {
          recommendationMap.set(item.agentName, item.recommendation);
        }
      }
    } catch (e) {
      console.warn('Performance trend batch AI failed, using fallback:', e);
    }
  }

  const agentTrends: AgentPerformanceTrend[] = rawTrends.map((t) => ({
    ...t,
    recommendation: recommendationMap.get(t.agentName) ?? FALLBACK_REC,
  }));

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = agentTrends
      .slice(0, 10)
      .map(
        (t) =>
          `${t.agentName}: trend=${t.trendDirection}, completionDelta=${(t.completionRateDelta * 100).toFixed(1)}%, stallDelta=${(t.stallRateDelta * 100).toFixed(1)}%`,
      )
      .join('\n');
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: `Summarize this team's performance trend health in 2-3 sentences: overall trend health, most at-risk agent, recommended routing adjustment.\n\n${summaryData}`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Performance trend summary AI failed, using fallback:', e);
  }

  const decliningAgents = agentTrends.filter((t) => t.trendDirection === 'declining').length;
  const improvingAgents = agentTrends.filter((t) => t.trendDirection === 'improving').length;
  const stableAgents = agentTrends.filter((t) => t.trendDirection === 'stable').length;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    windowDays: 30,
    totalAgents: agentTrends.length,
    improvingAgents,
    decliningAgents,
    stableAgents,
    agentTrends,
    aiSummary,
  };
}
