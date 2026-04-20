import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface StatusDuration {
  status: string;
  avgHoursHeld: number;
  isBottleneck: boolean;
}

export interface AgentVelocityMetrics {
  agentPersona: string;
  avgTotalCycleHours: number;
  velocityScore: number;
  rating: 'fast' | 'normal' | 'slow' | 'bottleneck';
  statusDurations: StatusDuration[];
  completedTickets: number;
}

export interface AgentTaskVelocityReport {
  projectId: string;
  analyzedAt: string;
  totalAgents: number;
  bottleneckAgents: number;
  fastestAgent: string | null;
  slowestAgent: string | null;
  agents: AgentVelocityMetrics[];
  aiSummary: string;
}

const FALLBACK_SUMMARY = 'Review agent task velocity to identify bottlenecks and optimize ticket completion times.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function calcVelocityScore(avgTotalCycleHours: number): number {
  const raw = Math.round((100 - avgTotalCycleHours / 2) * 10) / 10;
  return Math.min(100, Math.max(0, raw));
}

function calcRating(score: number): 'fast' | 'normal' | 'slow' | 'bottleneck' {
  if (score >= 75) return 'fast';
  if (score >= 50) return 'normal';
  if (score >= 25) return 'slow';
  return 'bottleneck';
}

const RATING_ORDER: Record<string, number> = { bottleneck: 0, slow: 1, normal: 2, fast: 3 };

export async function analyzeAgentTaskVelocity(projectId: string): Promise<AgentTaskVelocityReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  if (allTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalAgents: 0,
      bottleneckAgents: 0,
      fastestAgent: null,
      slowestAgent: null,
      agents: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const agentMap = new Map<string, typeof allTickets>();
  for (const t of allTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(t);
  }

  const rawAgents: AgentVelocityMetrics[] = [];

  for (const [persona, agentTickets] of agentMap.entries()) {
    const doneTickets = agentTickets.filter(t => t.status === 'done');
    let avgTotalCycleHours = 0;

    if (doneTickets.length > 0) {
      const totalMs = doneTickets.reduce((s, t) => s + Math.max(0, t.updatedAt.getTime() - t.createdAt.getTime()), 0);
      avgTotalCycleHours = totalMs / doneTickets.length / (1000 * 60 * 60);
    }

    const velocityScore = calcVelocityScore(avgTotalCycleHours);
    const rating = calcRating(velocityScore);

    // Status duration heuristic: avg cycle time split equally across statuses
    const statusDurations: StatusDuration[] = ['backlog', 'in_progress', 'review', 'qa', 'acceptance', 'done'].map(status => {
      const statusTickets = agentTickets.filter(t => t.status === status);
      const avgHoursHeld = statusTickets.length > 0 ? avgTotalCycleHours / 6 : 0;
      return { status, avgHoursHeld: Math.round(avgHoursHeld * 10) / 10, isBottleneck: avgHoursHeld > 48 };
    });

    rawAgents.push({
      agentPersona: persona,
      avgTotalCycleHours: Math.round(avgTotalCycleHours * 10) / 10,
      velocityScore,
      rating,
      statusDurations,
      completedTickets: doneTickets.length,
    });
  }

  // Sort: bottleneck→slow→normal→fast, within tier by velocityScore asc
  rawAgents.sort((a, b) => {
    const ratingDiff = RATING_ORDER[a.rating] - RATING_ORDER[b.rating];
    if (ratingDiff !== 0) return ratingDiff;
    return a.velocityScore - b.velocityScore;
  });

  const bottleneckAgents = rawAgents.filter(a => a.rating === 'bottleneck').length;
  const fastestAgent = rawAgents.length > 0 ? rawAgents[rawAgents.length - 1].agentPersona : null;
  const slowestAgent = rawAgents.length > 0 ? rawAgents[0].agentPersona : null;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;

  try {
    const statsData = JSON.stringify(rawAgents.slice(0, 5).map(a => ({
      agent: a.agentPersona,
      velocityScore: a.velocityScore,
      rating: a.rating,
      avgTotalCycleHours: a.avgTotalCycleHours,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze agent task velocity. Give 2-sentence summary. Output JSON: {aiSummary: string}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
  } catch (e) {
    console.warn('Agent task velocity AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalAgents: rawAgents.length,
    bottleneckAgents,
    fastestAgent,
    slowestAgent,
    agents: rawAgents,
    aiSummary,
  };
}
