import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, notInArray, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type StallSeverity = 'critical' | 'high' | 'moderate' | 'low';

export interface StalledTicket {
  ticketId: string;
  title: string;
  status: string;
  assignedPersona: string;
  stalledForHours: number;
  severity: StallSeverity;
}

export interface AgentStallSummary {
  agentPersona: string;
  stalledCount: number;
  avgStalledHours: number;
  worstStallHours: number;
  stalledTickets: StalledTicket[];
}

export interface StallDetectionReport {
  projectId: string;
  totalStalledTickets: number;
  criticalStalls: number;
  agentSummaries: AgentStallSummary[];
  mostStalledAgent: string | null;
  aiRecommendation: string;
  analyzedAt: string;
}

const FALLBACK_RECOMMENDATION =
  'Review stalled tickets for missing context or blocking dependencies. Reassign or add handoff notes to unblock.';

export function computeSeverity(hours: number): StallSeverity {
  if (hours >= 72) return 'critical';
  if (hours >= 48) return 'high';
  if (hours >= 24) return 'moderate';
  return 'low';
}

export async function detectAgentStalls(projectId: string): Promise<StallDetectionReport> {
  const now = new Date();

  const activeTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        notInArray(tickets.status, ['done', 'cancelled']),
        isNotNull(tickets.assignedPersona),
      ),
    );

  const stalledTickets: StalledTicket[] = [];

  for (const t of activeTickets) {
    const updatedAt = t.updatedAt ? new Date(t.updatedAt) : now;
    const stalledForHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
    if (stalledForHours < 12) continue;

    stalledTickets.push({
      ticketId: t.id,
      title: t.title ?? '',
      status: t.status ?? '',
      assignedPersona: t.assignedPersona as string,
      stalledForHours: Math.round(stalledForHours * 10) / 10,
      severity: computeSeverity(stalledForHours),
    });
  }

  if (stalledTickets.length === 0) {
    return {
      projectId,
      totalStalledTickets: 0,
      criticalStalls: 0,
      agentSummaries: [],
      mostStalledAgent: null,
      aiRecommendation: FALLBACK_RECOMMENDATION,
      analyzedAt: now.toISOString(),
    };
  }

  const agentMap = new Map<string, StalledTicket[]>();
  for (const t of stalledTickets) {
    if (!agentMap.has(t.assignedPersona)) agentMap.set(t.assignedPersona, []);
    agentMap.get(t.assignedPersona)!.push(t);
  }

  const agentSummaries: AgentStallSummary[] = [];
  for (const [persona, ts] of agentMap) {
    const hours = ts.map((t) => t.stalledForHours);
    agentSummaries.push({
      agentPersona: persona,
      stalledCount: ts.length,
      avgStalledHours: Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10,
      worstStallHours: Math.max(...hours),
      stalledTickets: ts,
    });
  }

  agentSummaries.sort((a, b) => b.stalledCount - a.stalledCount);

  const criticalStalls = stalledTickets.filter((t) => t.severity === 'critical').length;
  const mostStalledAgent = agentSummaries[0]?.agentPersona ?? null;

  let aiRecommendation = FALLBACK_RECOMMENDATION;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const summary = agentSummaries
      .map(
        (s) =>
          `Agent: ${s.agentPersona}, Stalled: ${s.stalledCount}, AvgHours: ${s.avgStalledHours}, WorstHours: ${s.worstStallHours}`,
      )
      .join('\n');

    const prompt = `Analyze this agent stall data and write a single paragraph (2-3 sentences) with actionable recommendations for resolving stalls and preventing future ones. Be concise.\n\n${summary}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) aiRecommendation = content;
  } catch (e) {
    console.warn('Stall detector AI recommendation failed, using fallback:', e);
  }

  return {
    projectId,
    totalStalledTickets: stalledTickets.length,
    criticalStalls,
    agentSummaries,
    mostStalledAgent,
    aiRecommendation,
    analyzedAt: now.toISOString(),
  };
}
