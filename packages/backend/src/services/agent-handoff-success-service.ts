import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type HandoffRating = 'excellent' | 'good' | 'poor' | 'critical';

export interface HandoffPair {
  fromAgent: string;
  toAgent: string;
  totalHandoffs: number;
  successfulHandoffs: number;
  stalledHandoffs: number;
  successRate: number;
  rating: HandoffRating;
  recommendation: string;
}

export interface HandoffSuccessReport {
  projectId: string;
  analyzedAt: string;
  totalPairs: number;
  criticalPairs: number;
  avgSuccessRate: number;
  pairs: HandoffPair[];
  aiSummary: string;
}

const FALLBACK_RECOMMENDATION = 'Improve handoff context by adding detailed ticket descriptions and linking to relevant epics.';
const FALLBACK_SUMMARY = 'Strengthen inter-agent handoffs by ensuring tickets carry rich context before reassignment.';

function ratingOrder(r: HandoffRating): number {
  switch (r) {
    case 'critical': return 0;
    case 'poor': return 1;
    case 'good': return 2;
    case 'excellent': return 3;
  }
}

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

export async function analyzeHandoffSuccess(projectId: string): Promise<HandoffSuccessReport> {
  const now = new Date();
  const STALL_THRESHOLD_MS = 72 * 60 * 60 * 1000;

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      epicId: tickets.epicId,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        isNotNull(tickets.assignedPersona),
      ),
    );

  const assignedTickets = allTickets.filter(t => t.assignedPersona != null && t.assignedPersona.trim() !== '');

  if (assignedTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalPairs: 0,
      criticalPairs: 0,
      avgSuccessRate: 0,
      pairs: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  // Group by epicId
  const epicMap = new Map<string, typeof assignedTickets>();
  for (const t of assignedTickets) {
    if (!t.epicId) continue;
    if (!epicMap.has(t.epicId)) epicMap.set(t.epicId, []);
    epicMap.get(t.epicId)!.push(t);
  }

  // Build pair counts: map key = "fromAgent::toAgent"
  interface PairData {
    totalHandoffs: number;
    successfulHandoffs: number;
    stalledHandoffs: number;
  }
  const pairMap = new Map<string, PairData>();

  for (const [, epicTickets] of epicMap.entries()) {
    const sorted = [...epicTickets].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (sorted.length < 2) continue;

    const fromAgent = sorted[0].assignedPersona!;
    for (let i = 1; i < sorted.length; i++) {
      const toAgent = sorted[i].assignedPersona!;
      if (fromAgent === toAgent) continue;

      const key = `${fromAgent}::${toAgent}`;
      if (!pairMap.has(key)) pairMap.set(key, { totalHandoffs: 0, successfulHandoffs: 0, stalledHandoffs: 0 });
      const entry = pairMap.get(key)!;
      entry.totalHandoffs++;

      const t = sorted[i];
      if (t.status === 'done') {
        entry.successfulHandoffs++;
      } else if (
        (t.status === 'backlog' || t.status === 'in_progress') &&
        now.getTime() - t.updatedAt.getTime() > STALL_THRESHOLD_MS
      ) {
        entry.stalledHandoffs++;
      }
    }
  }

  // Build HandoffPair array, filter pairs with totalHandoffs < 2
  const rawPairs: HandoffPair[] = [];
  for (const [key, data] of pairMap.entries()) {
    if (data.totalHandoffs < 2) continue;
    const [fromAgent, toAgent] = key.split('::');
    const successRate = data.successfulHandoffs / data.totalHandoffs;

    let rating: HandoffRating;
    if (successRate >= 0.80) rating = 'excellent';
    else if (successRate >= 0.60) rating = 'good';
    else if (successRate >= 0.30) rating = 'poor';
    else rating = 'critical';

    rawPairs.push({
      fromAgent,
      toAgent,
      totalHandoffs: data.totalHandoffs,
      successfulHandoffs: data.successfulHandoffs,
      stalledHandoffs: data.stalledHandoffs,
      successRate,
      rating,
      recommendation: FALLBACK_RECOMMENDATION,
    });
  }

  rawPairs.sort((a, b) => {
    const ratingDiff = ratingOrder(a.rating) - ratingOrder(b.rating);
    return ratingDiff !== 0 ? ratingDiff : a.successRate - b.successRate;
  });

  if (rawPairs.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      totalPairs: 0,
      criticalPairs: 0,
      avgSuccessRate: 0,
      pairs: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const recommendationMap = new Map<string, string>();
  const priorityPairs = rawPairs.filter(p => p.rating === 'critical' || p.rating === 'poor');
  const batchPairs = priorityPairs.slice(0, 4);

  for (let i = 0; i < batchPairs.length; i += 4) {
    const batch = batchPairs.slice(i, i + 4);
    try {
      const prompts = batch
        .map(p =>
          `Pair '${p.fromAgent}→${p.toAgent}': successRate=${(p.successRate * 100).toFixed(0)}% (${p.rating}), ${p.stalledHandoffs} stalled. Give ONE action (max 20 words) to improve this handoff.`
        )
        .join('\n---\n');
      const prompt = `For each agent handoff pair below, give one specific recommendation. Output as JSON array [{fromAgent, toAgent, recommendation}].\n\n${prompts}`;
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonStr = extractJSONFromText(text);
      const parsed = JSON.parse(jsonStr) as Array<{ fromAgent: string; toAgent: string; recommendation: string }>;
      for (const item of parsed) {
        if (item.fromAgent && item.toAgent && item.recommendation) {
          recommendationMap.set(`${item.fromAgent}::${item.toAgent}`, item.recommendation);
        }
      }
    } catch (e) {
      console.warn('Handoff success batch AI failed, using fallback:', e);
    }
  }

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const summaryData = JSON.stringify(
      rawPairs.map(p => ({ from: p.fromAgent, to: p.toAgent, rate: p.successRate.toFixed(2), rating: p.rating }))
    );
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Summarize agent handoff health in 2-3 sentences: overall health, worst pair, one recommendation. Output JSON: {summary: string}.\n\n${summaryData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonStr = extractJSONFromText(text);
    const parsed = JSON.parse(jsonStr) as { summary: string };
    if (parsed.summary) aiSummary = parsed.summary;
  } catch (e) {
    console.warn('Handoff success summary AI failed, using fallback:', e);
  }

  const pairs: HandoffPair[] = rawPairs.map(p => ({
    ...p,
    recommendation: recommendationMap.get(`${p.fromAgent}::${p.toAgent}`) ?? FALLBACK_RECOMMENDATION,
  }));

  const criticalPairs = pairs.filter(p => p.rating === 'critical').length;
  const avgSuccessRate = pairs.reduce((sum, p) => sum + p.successRate, 0) / pairs.length;

  return {
    projectId,
    analyzedAt: now.toISOString(),
    totalPairs: pairs.length,
    criticalPairs,
    avgSuccessRate,
    pairs,
    aiSummary,
  };
}
