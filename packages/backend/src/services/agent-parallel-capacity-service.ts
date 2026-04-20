import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentParallelMetrics {
  agentPersona: string;
  currentParallelCount: number;
  efficiencyScore: number;
  rating: 'optimal' | 'loaded' | 'overloaded' | 'saturated';
}

export interface AgentParallelCapacityReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentParallelMetrics[];
  maxParallelLoad: number;
  avgParallelLoad: number;
  overloadedAgentCount: number;
  optimalConcurrency: number;
  aiSummary: string;
  recommendations: string[];
}

const FALLBACK_SUMMARY = 'Review parallel task load to identify overloaded agents and optimize concurrent task distribution.';
const FALLBACK_RECOMMENDATIONS = ['Redistribute in-progress tickets from overloaded agents to maintain optimal concurrency.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function calcRating(count: number): 'optimal' | 'loaded' | 'overloaded' | 'saturated' {
  if (count <= 2) return 'optimal';
  if (count <= 4) return 'loaded';
  if (count <= 6) return 'overloaded';
  return 'saturated';
}

const RATING_ORDER: Record<string, number> = { saturated: 0, overloaded: 1, loaded: 2, optimal: 3 };

export async function analyzeParallelCapacity(projectId: string): Promise<AgentParallelCapacityReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  if (allTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      maxParallelLoad: 0,
      avgParallelLoad: 0,
      overloadedAgentCount: 0,
      optimalConcurrency: 2,
      aiSummary: FALLBACK_SUMMARY,
      recommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Count all assigned agents (even those with 0 in_progress)
  const agentInProgress = new Map<string, number>();
  for (const t of allTickets) {
    const persona = t.assignedPersona!;
    if (!agentInProgress.has(persona)) agentInProgress.set(persona, 0);
    if (t.status === 'in_progress') {
      agentInProgress.set(persona, agentInProgress.get(persona)! + 1);
    }
  }

  const rawAgents: AgentParallelMetrics[] = [...agentInProgress.entries()].map(([persona, count]) => ({
    agentPersona: persona,
    currentParallelCount: count,
    efficiencyScore: Math.round((1.0 / Math.max(1, count)) * 100) / 100,
    rating: calcRating(count),
  }));

  rawAgents.sort((a, b) => {
    const ratingDiff = RATING_ORDER[a.rating] - RATING_ORDER[b.rating];
    if (ratingDiff !== 0) return ratingDiff;
    return b.currentParallelCount - a.currentParallelCount;
  });

  const maxParallelLoad = rawAgents.length > 0 ? Math.max(...rawAgents.map(a => a.currentParallelCount)) : 0;
  const avgParallelLoad = rawAgents.length > 0
    ? Math.round(rawAgents.reduce((s, a) => s + a.currentParallelCount, 0) / rawAgents.length * 100) / 100
    : 0;
  const overloadedAgentCount = rawAgents.filter(a => a.rating === 'overloaded' || a.rating === 'saturated').length;
  const optimalConcurrency = avgParallelLoad <= 3 ? 2 : 1;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify({ maxParallelLoad, avgParallelLoad, overloadedAgentCount, agents: rawAgents.slice(0, 5) });
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent parallel task capacity. Give 2-sentence summary and 2-3 recommendations. Output JSON: {aiSummary: string, recommendations: string[]}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string; recommendations: string[] };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
    if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) recommendations = parsed.recommendations;
  } catch (e) {
    console.warn('Agent parallel capacity AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents: rawAgents,
    maxParallelLoad,
    avgParallelLoad,
    overloadedAgentCount,
    optimalConcurrency,
    aiSummary,
    recommendations,
  };
}
