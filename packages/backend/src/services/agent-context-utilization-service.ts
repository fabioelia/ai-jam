import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, notInArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type ContextRating = 'excellent' | 'good' | 'poor' | 'critical';

export interface AgentContextProfile {
  agentPersona: string;
  totalTickets: number;
  ticketsWithDescription: number;
  ticketsWithLinkedHandoffs: number;
  avgDescriptionLength: number;
  contextScore: number;
  contextRating: ContextRating;
  recommendation: string;
}

export interface ContextUtilizationReport {
  projectId: string;
  analyzedAt: string;
  profiles: AgentContextProfile[];
  summary: string;
  criticalAgents: string[];
}

const FALLBACK_RECOMMENDATION = 'Add detailed descriptions and link tickets to epics to improve context for future agent sessions.';
const FALLBACK_SUMMARY = 'Review agent context utilization and encourage richer ticket descriptions and epic linkage to improve AI agent effectiveness.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function ratingOrder(r: ContextRating): number {
  switch (r) {
    case 'critical': return 0;
    case 'poor': return 1;
    case 'good': return 2;
    case 'excellent': return 3;
  }
}

export async function analyzeContextUtilization(projectId: string): Promise<ContextUtilizationReport> {
  const now = new Date();
  const EXCLUDE_STATUSES = ['done', 'backlog'];

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      description: tickets.description,
      epicId: tickets.epicId,
      status: tickets.status,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        notInArray(tickets.status, EXCLUDE_STATUSES as any),
      ),
    );

  // Also apply in-memory filter in case mock or legacy path returns extra rows
  const filteredTickets = allTickets.filter(t => !EXCLUDE_STATUSES.includes(t.status));
  const assignedTickets = filteredTickets.filter(t => t.assignedPersona != null && t.assignedPersona.trim() !== '');

  if (assignedTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      profiles: [],
      summary: FALLBACK_SUMMARY,
      criticalAgents: [],
    };
  }

  const agentMap = new Map<string, typeof assignedTickets>();
  for (const t of assignedTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(t);
  }

  type RawProfile = AgentContextProfile & { descRatio: number; epicRatio: number };

  const rawProfiles: RawProfile[] = [];

  for (const [persona, ticketList] of agentMap.entries()) {
    const totalTickets = Number(ticketList.length);
    const ticketsWithDescription = Number(ticketList.filter(t => t.description && t.description.trim().length > 50).length);
    const ticketsWithLinkedHandoffs = Number(ticketList.filter(t => t.epicId != null).length);
    const avgDescriptionLength = Math.round(ticketList.reduce((sum, t) => sum + (t.description?.length ?? 0), 0) / totalTickets);

    const descRatio = ticketsWithDescription / totalTickets;
    const epicRatio = ticketsWithLinkedHandoffs / totalTickets;
    const avgLengthScore = Math.min(avgDescriptionLength / 500, 1.0);
    const contextScore = Math.round((descRatio * 50 + epicRatio * 30 + avgLengthScore * 20) * 10) / 10;

    let contextRating: ContextRating;
    if (contextScore >= 75) contextRating = 'excellent';
    else if (contextScore >= 50) contextRating = 'good';
    else if (contextScore >= 25) contextRating = 'poor';
    else contextRating = 'critical';

    rawProfiles.push({
      agentPersona: persona,
      totalTickets,
      ticketsWithDescription,
      ticketsWithLinkedHandoffs,
      avgDescriptionLength,
      contextScore,
      contextRating,
      recommendation: FALLBACK_RECOMMENDATION,
      descRatio,
      epicRatio,
    });
  }

  rawProfiles.sort((a, b) => {
    const ratingDiff = ratingOrder(a.contextRating) - ratingOrder(b.contextRating);
    return ratingDiff !== 0 ? ratingDiff : a.contextScore - b.contextScore;
  });

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const recommendationMap = new Map<string, string>();
  for (let i = 0; i < rawProfiles.length; i += 4) {
    const batch = rawProfiles.slice(i, i + 4);
    try {
      const prompts = batch
        .map(p =>
          `Agent '${p.agentPersona}' has contextScore=${p.contextScore} (${p.contextRating}). descRatio=${p.descRatio.toFixed(2)}, epicRatio=${p.epicRatio.toFixed(2)}, avgDescLen=${p.avgDescriptionLength}. Give ONE specific recommendation (max 25 words) to improve their context utilization.`
        )
        .join('\n---\n');
      const prompt = `For each agent profile below, give one specific recommendation. Output as JSON array of objects {persona, recommendation}.\n\n${prompts}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonStr = extractJSONFromText(text);
      const parsed = JSON.parse(jsonStr) as Array<{ persona: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.persona && item.recommendation) {
          recommendationMap.set(item.persona, item.recommendation);
        }
      }
    } catch (e) {
      console.warn('Context utilization batch AI failed, using fallback:', e);
    }
  }

  let summary = FALLBACK_SUMMARY;
  try {
    const summaryData = JSON.stringify(
      rawProfiles.map(p => ({ persona: p.agentPersona, score: p.contextScore, rating: p.contextRating }))
    );
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Summarize agent context utilization health in max 40 words. Output JSON: {summary: string}.\n\n${summaryData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonStr = extractJSONFromText(text);
    const parsed = JSON.parse(jsonStr) as { summary: string };
    if (parsed.summary) summary = parsed.summary;
  } catch (e) {
    console.warn('Context utilization summary AI failed, using fallback:', e);
  }

  const profiles: AgentContextProfile[] = rawProfiles.map(p => ({
    agentPersona: p.agentPersona,
    totalTickets: p.totalTickets,
    ticketsWithDescription: p.ticketsWithDescription,
    ticketsWithLinkedHandoffs: p.ticketsWithLinkedHandoffs,
    avgDescriptionLength: p.avgDescriptionLength,
    contextScore: p.contextScore,
    contextRating: p.contextRating,
    recommendation: recommendationMap.get(p.agentPersona) ?? FALLBACK_RECOMMENDATION,
  }));

  const criticalAgents = profiles.filter(p => p.contextRating === 'critical').map(p => p.agentPersona);

  return {
    projectId,
    analyzedAt: now.toISOString(),
    profiles,
    summary,
    criticalAgents,
  };
}
