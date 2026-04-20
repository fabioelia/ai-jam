import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentQualitySpeedData {
  agentId: string;
  agentName: string;
  tasksCompleted: number;
  avgCompletionTimeHours: number;
  avgQualityScore: number;
  reviewPassRate: number;
  firstPassRate: number;
  revisionCount: number;
  tradeoffScore: number;
  tradeoffTier: 'optimized' | 'balanced' | 'quality-focused' | 'speed-focused' | 'struggling';
}

export interface AgentQualitySpeedReport {
  projectId: string;
  generatedAt: string;
  summary: {
    totalAgents: number;
    avgTradeoffScore: number;
    mostOptimizedAgent: string;
    mostStrugglingAgent: string;
    optimizedAgentCount: number;
  };
  agents: AgentQualitySpeedData[];
  insights: string[];
  recommendations: string[];
}

export function computeTradeoffScore(
  firstPassRate: number,
  avgQualityScore: number,
  avgCompletionTimeHours: number,
): number {
  const qualityComponent = firstPassRate * 0.4 + avgQualityScore * 0.4;
  const speedComponent = Math.min(
    20,
    Math.max(0, 20 - (avgCompletionTimeHours / 48) * 20),
  );
  return Math.min(100, Math.max(0, Math.round(qualityComponent + speedComponent)));
}

export function getTradeoffTier(
  score: number,
): AgentQualitySpeedData['tradeoffTier'] {
  if (score >= 75) return 'optimized';
  if (score >= 55) return 'balanced';
  if (score >= 40) return 'quality-focused';
  if (score >= 25) return 'speed-focused';
  return 'struggling';
}

export async function analyzeAgentQualitySpeed(
  projectId: string,
): Promise<AgentQualitySpeedReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  if (allTickets.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgTradeoffScore: 0,
        mostOptimizedAgent: '',
        mostStrugglingAgent: '',
        optimizedAgentCount: 0,
      },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  // Group by agent
  type TicketRow = { id: string; status: string; createdAt: Date; updatedAt: Date };
  const agentMap = new Map<string, TicketRow[]>();
  for (const t of allTickets) {
    const persona = t.assignedPersona as string | null;
    if (!persona) continue;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push({
      id: t.id,
      status: t.status as string,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    });
  }

  if (agentMap.size === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAgents: 0,
        avgTradeoffScore: 0,
        mostOptimizedAgent: '',
        mostStrugglingAgent: '',
        optimizedAgentCount: 0,
      },
      agents: [],
      insights: [],
      recommendations: [],
    };
  }

  const agents: AgentQualitySpeedData[] = [];

  for (const [agentId, agentTickets] of agentMap.entries()) {
    const doneTickets = agentTickets.filter((t) => t.status === 'done');
    const tasksCompleted = doneTickets.length;

    // Avg completion time in hours for done tickets
    const completionTimesHours = doneTickets.map((t) => {
      const ms = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
      return Math.max(0, ms) / (1000 * 60 * 60);
    });
    const avgCompletionTimeHours =
      completionTimesHours.length > 0
        ? completionTimesHours.reduce((a, b) => a + b, 0) / completionTimesHours.length
        : 0;

    // Review pass rate = done / total (proxy: tickets that reached done without bouncing back)
    const reviewPassRate =
      agentTickets.length > 0 ? (doneTickets.length / agentTickets.length) * 100 : 0;

    // First pass rate = done tickets that completed in < 48h (proxy for no revision needed)
    const firstPassDone = doneTickets.filter((t) => {
      const hrs =
        (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) /
        (1000 * 60 * 60);
      return hrs < 48;
    });
    const firstPassRate =
      doneTickets.length > 0 ? (firstPassDone.length / doneTickets.length) * 100 : 0;

    // Revision count = tickets stuck in review/qa (proxy for rework)
    const revisionCount = agentTickets.filter(
      (t) => t.status === 'review' || t.status === 'qa',
    ).length;

    // Avg quality score: based on review pass rate + first pass rate composite
    const avgQualityScore = Math.round((reviewPassRate * 0.6 + firstPassRate * 0.4));

    const tradeoffScore = computeTradeoffScore(
      firstPassRate,
      avgQualityScore,
      avgCompletionTimeHours,
    );
    const tradeoffTier = getTradeoffTier(tradeoffScore);

    agents.push({
      agentId,
      agentName: agentId,
      tasksCompleted,
      avgCompletionTimeHours: Math.round(avgCompletionTimeHours * 10) / 10,
      avgQualityScore: Math.round(avgQualityScore * 10) / 10,
      reviewPassRate: Math.round(reviewPassRate * 10) / 10,
      firstPassRate: Math.round(firstPassRate * 10) / 10,
      revisionCount,
      tradeoffScore,
      tradeoffTier,
    });
  }

  agents.sort((a, b) => b.tradeoffScore - a.tradeoffScore);

  const avgTradeoffScore =
    agents.length > 0
      ? Math.round(agents.reduce((a, b) => a + b.tradeoffScore, 0) / agents.length)
      : 0;

  const mostOptimizedAgent = agents[0]?.agentId ?? '';
  const mostStrugglingAgent = agents[agents.length - 1]?.agentId ?? '';
  const optimizedAgentCount = agents.filter((a) => a.tradeoffTier === 'optimized').length;

  let insights: string[] = [];
  let recommendations: string[] = [];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const agentLines = agents
      .map(
        (a) =>
          `Agent: ${a.agentId}, score: ${a.tradeoffScore}, tier: ${a.tradeoffTier}, firstPassRate: ${a.firstPassRate}%, avgCompletionHours: ${a.avgCompletionTimeHours}, qualityScore: ${a.avgQualityScore}`,
      )
      .join('\n');

    const prompt = `You are an AI project efficiency analyst. Analyze agent quality-speed tradeoff data and produce a brief JSON summary. Output ONLY a JSON object with keys "insights" (array of 2-3 strings) and "recommendations" (array of 2-3 strings). No other text.

Most optimized: ${mostOptimizedAgent}
Most struggling: ${mostStrugglingAgent}
Avg tradeoff score: ${avgTradeoffScore}
Optimized agents: ${optimizedAgentCount}/${agents.length}

Agents:
${agentLines}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.insights)) insights = parsed.insights;
      if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
    }
  } catch (e) {
    console.warn('Agent quality-speed AI analysis failed:', e);
  }

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalAgents: agents.length,
      avgTradeoffScore,
      mostOptimizedAgent,
      mostStrugglingAgent,
      optimizedAgentCount,
    },
    agents,
    insights,
    recommendations,
  };
}
