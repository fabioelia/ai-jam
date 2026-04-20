import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentContextSwitchMetrics {
  agentPersona: string;
  totalTickets: number;
  contextSwitches: number;
  switchRate: number;
  focusScore: number;
  rating: 'focused' | 'moderate' | 'scattered' | 'chaotic';
  avgSwitchesPerDay: number;
  dominantEpic: string | null;
}

export interface AgentContextSwitchReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentContextSwitchMetrics[];
  totalSwitches: number;
  avgSwitchRate: number;
  mostScatteredAgent: string | null;
  focusedAgentCount: number;
  aiSummary: string;
  recommendations: string[];
}

const FALLBACK_SUMMARY = 'Review context switch patterns to identify agents with high task fragmentation.';
const FALLBACK_RECOMMENDATIONS = ['Reduce context switching by grouping related epic tasks for the same agent.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function calcRating(focusScore: number): 'focused' | 'moderate' | 'scattered' | 'chaotic' {
  if (focusScore >= 0.75) return 'focused';
  if (focusScore >= 0.50) return 'moderate';
  if (focusScore >= 0.25) return 'scattered';
  return 'chaotic';
}

const RATING_ORDER: Record<string, number> = { chaotic: 0, scattered: 1, moderate: 2, focused: 3 };

export async function analyzeContextSwitchCost(projectId: string): Promise<AgentContextSwitchReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      epicId: tickets.epicId,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  if (allTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      totalSwitches: 0,
      avgSwitchRate: 0,
      mostScatteredAgent: null,
      focusedAgentCount: 0,
      aiSummary: FALLBACK_SUMMARY,
      recommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  const agentMap = new Map<string, { id: string; epicId: string | null; createdAt: Date }[]>();
  for (const t of allTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push({ id: t.id, epicId: t.epicId, createdAt: t.createdAt });
  }

  const rawAgents: AgentContextSwitchMetrics[] = [];

  for (const [persona, agentTickets] of agentMap.entries()) {
    const sorted = [...agentTickets].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const totalTickets = sorted.length;

    let contextSwitches = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].epicId !== sorted[i - 1].epicId) contextSwitches++;
    }

    const switchRate = contextSwitches / Math.max(1, totalTickets - 1);
    const focusScore = 1 - switchRate;
    const rating = calcRating(focusScore);

    const firstTicket = sorted[0];
    const daysSinceFirstTicket = Math.max(1, (now.getTime() - firstTicket.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const avgSwitchesPerDay = contextSwitches / daysSinceFirstTicket;

    // dominantEpic: epicId with most tickets
    const epicCounts = new Map<string, number>();
    for (const t of sorted) {
      if (t.epicId) epicCounts.set(t.epicId, (epicCounts.get(t.epicId) || 0) + 1);
    }
    let dominantEpic: string | null = null;
    let maxEpicCount = 0;
    for (const [epicId, count] of epicCounts.entries()) {
      if (count > maxEpicCount) { maxEpicCount = count; dominantEpic = epicId; }
    }

    rawAgents.push({
      agentPersona: persona,
      totalTickets,
      contextSwitches,
      switchRate: Math.round(switchRate * 1000) / 1000,
      focusScore: Math.round(focusScore * 1000) / 1000,
      rating,
      avgSwitchesPerDay: Math.round(avgSwitchesPerDay * 100) / 100,
      dominantEpic,
    });
  }

  // Sort chaotic→scattered→moderate→focused, within tier by switchRate asc (lower switch = better)
  rawAgents.sort((a, b) => {
    const ratingDiff = RATING_ORDER[a.rating] - RATING_ORDER[b.rating];
    if (ratingDiff !== 0) return ratingDiff;
    return b.switchRate - a.switchRate;
  });

  const totalSwitches = rawAgents.reduce((s, a) => s + a.contextSwitches, 0);
  const avgSwitchRate = rawAgents.length > 0
    ? Math.round(rawAgents.reduce((s, a) => s + a.switchRate, 0) / rawAgents.length * 1000) / 1000
    : 0;
  const mostScatteredAgent = rawAgents.length > 0 ? rawAgents[0].agentPersona : null;
  const focusedAgentCount = rawAgents.filter(a => a.rating === 'focused').length;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify(rawAgents.slice(0, 5).map(a => ({
      agent: a.agentPersona,
      switchRate: a.switchRate,
      focusScore: a.focusScore,
      rating: a.rating,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent context switching patterns. Give 2-sentence summary and 2-3 recommendations. Output JSON: {aiSummary: string, recommendations: string[]}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string; recommendations: string[] };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
    if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations = parsed.recommendations;
  } catch (e) {
    console.warn('Agent context switch AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents: rawAgents,
    totalSwitches,
    avgSwitchRate,
    mostScatteredAgent,
    focusedAgentCount,
    aiSummary,
    recommendations,
  };
}
