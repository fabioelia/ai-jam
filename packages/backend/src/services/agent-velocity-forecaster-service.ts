import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, isNotNull, gte, lte } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentVelocity {
  agentName: string;
  recentPoints: number;
  priorPoints: number;
  recentCount: number;
  priorCount: number;
  forecastPoints: number;
  trend: 'up' | 'down' | 'stable' | 'new';
  recommendation: string;
}

export interface VelocityForecastReport {
  projectId: string;
  agentVelocities: AgentVelocity[];
  totalAgents: number;
  totalForecastPoints: number;
  topAgent: string | null;
  atRiskAgents: string[];
  generatedAt: string;
}

const FALLBACK_STABLE = 'Maintain current pace';
const FALLBACK_UP = 'Strong momentum — keep going';
const FALLBACK_DOWN = 'Review workload and blockers';

function getTrendFallback(trend: 'up' | 'down' | 'stable' | 'new'): string {
  if (trend === 'up') return FALLBACK_UP;
  if (trend === 'down') return FALLBACK_DOWN;
  return FALLBACK_STABLE;
}

function computeTrend(recentPoints: number, priorPoints: number): 'up' | 'down' | 'stable' | 'new' {
  if (priorPoints === 0) return 'new';
  if (recentPoints >= priorPoints * 1.1) return 'up';
  if (recentPoints <= priorPoints * 0.9) return 'down';
  return 'stable';
}

export async function forecastVelocity(projectId: string): Promise<VelocityForecastReport> {
  const now = new Date();
  const recentStart = new Date(now.getTime() - 14 * 86400000);
  const priorStart = new Date(now.getTime() - 28 * 86400000);
  const priorEnd = new Date(now.getTime() - 15 * 86400000);

  const doneTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      storyPoints: tickets.storyPoints,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        eq(tickets.status, 'done'),
        isNotNull(tickets.assignedPersona),
        isNotNull(tickets.updatedAt),
        gte(tickets.updatedAt, priorStart),
      ),
    );

  type AgentBucket = {
    recentPoints: number;
    priorPoints: number;
    recentCount: number;
    priorCount: number;
  };

  const agentMap = new Map<string, AgentBucket>();

  for (const ticket of doneTickets) {
    const persona = ticket.assignedPersona as string;
    const updatedAt = new Date(ticket.updatedAt);
    const points = ticket.storyPoints ?? 2;

    if (!agentMap.has(persona)) {
      agentMap.set(persona, { recentPoints: 0, priorPoints: 0, recentCount: 0, priorCount: 0 });
    }

    const bucket = agentMap.get(persona)!;

    if (updatedAt >= recentStart) {
      bucket.recentPoints += points;
      bucket.recentCount += 1;
    } else if (updatedAt >= priorStart && updatedAt <= priorEnd) {
      bucket.priorPoints += points;
      bucket.priorCount += 1;
    }
  }

  if (agentMap.size === 0) {
    return {
      projectId,
      agentVelocities: [],
      totalAgents: 0,
      totalForecastPoints: 0,
      topAgent: null,
      atRiskAgents: [],
      generatedAt: new Date().toISOString(),
    };
  }

  type AgentIntermediate = AgentBucket & { agentName: string; trend: 'up' | 'down' | 'stable' | 'new' };
  const intermediates: AgentIntermediate[] = [];

  for (const [agentName, bucket] of agentMap.entries()) {
    const trend = computeTrend(bucket.recentPoints, bucket.priorPoints);
    intermediates.push({ agentName, ...bucket, trend });
  }

  // Generate AI recommendations for up/down agents (max 3)
  const aiCandidates = intermediates
    .filter((a) => a.trend === 'up' || a.trend === 'down')
    .slice(0, 3);

  const recommendations = new Map<string, string>();

  if (aiCandidates.length > 0) {
    try {
      const client = new Anthropic({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
      });

      const agentLines = aiCandidates
        .map(
          (a) =>
            `Agent: ${a.agentName}, recentPoints: ${a.recentPoints}, priorPoints: ${a.priorPoints}, trend: ${a.trend}`,
        )
        .join('\n');

      const prompt = `You are an agile coach. For each agent below, give ≤12 words of coaching advice. Output ONLY a JSON object mapping agentName to advice string. No other text.

${agentLines}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [name, rec] of Object.entries(parsed)) {
          recommendations.set(name, rec as string);
        }
      }
    } catch (e) {
      console.warn('Agent velocity AI recommendations failed, using fallback:', e);
    }
  }

  const agentVelocities: AgentVelocity[] = intermediates.map((a) => {
    const rec =
      recommendations.get(a.agentName) ?? getTrendFallback(a.trend);
    return {
      agentName: a.agentName,
      recentPoints: a.recentPoints,
      priorPoints: a.priorPoints,
      recentCount: a.recentCount,
      priorCount: a.priorCount,
      forecastPoints: a.recentPoints,
      trend: a.trend,
      recommendation: rec,
    };
  });

  agentVelocities.sort((a, b) => b.forecastPoints - a.forecastPoints);

  const totalAgents = agentVelocities.length;
  const totalForecastPoints = agentVelocities.reduce((sum, a) => sum + a.forecastPoints, 0);
  const topAgent = agentVelocities.length > 0 ? agentVelocities[0].agentName : null;
  const atRiskAgents = agentVelocities.filter((a) => a.trend === 'down').map((a) => a.agentName);

  return {
    projectId,
    agentVelocities,
    totalAgents,
    totalForecastPoints,
    topAgent,
    atRiskAgents,
    generatedAt: new Date().toISOString(),
  };
}
