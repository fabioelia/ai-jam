import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentEstimationMetrics {
  agentPersona: string;
  ticketsAnalyzed: number;
  avgAccuracyScore: number;
  avgEstimatedHours: number;
  avgActualHours: number;
  bias: 'overestimator' | 'underestimator' | 'accurate';
}

export interface AgentEstimationAccuracyReport {
  projectId: string;
  analyzedAt: string;
  agentCount: number;
  ticketsAnalyzed: number;
  baselineHoursPerPoint: number;
  avgAccuracyScore: number;
  mostAccurateAgent: string | null;
  leastAccurateAgent: string | null;
  agents: AgentEstimationMetrics[];
  aiSummary: string;
}

const FALLBACK_SUMMARY = 'Review estimation accuracy to improve story point calibration and sprint planning reliability.';

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

export async function analyzeEstimationAccuracy(projectId: string): Promise<AgentEstimationAccuracyReport> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      storyPoints: tickets.storyPoints,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  // Only done tickets with story points
  const eligibleTickets = allTickets.filter(t => t.status === 'done' && t.storyPoints != null);

  if (eligibleTickets.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agentCount: 0,
      ticketsAnalyzed: 0,
      baselineHoursPerPoint: 0,
      avgAccuracyScore: 0,
      mostAccurateAgent: null,
      leastAccurateAgent: null,
      agents: [],
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  // Compute baseline
  const totalHours = eligibleTickets.reduce((s, t) => {
    const h = Math.max(0, (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
    return s + h;
  }, 0);
  const totalPoints = eligibleTickets.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
  const baselineHoursPerPoint = totalPoints > 0 ? totalHours / totalPoints : 0;

  // Per-agent
  const agentMap = new Map<string, { estimatedHours: number; actualHours: number; count: number; accuracySum: number }>();

  for (const t of eligibleTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, { estimatedHours: 0, actualHours: 0, count: 0, accuracySum: 0 });
    const entry = agentMap.get(persona)!;

    const estimatedHours = (t.storyPoints ?? 0) * baselineHoursPerPoint;
    const actualHours = Math.max(0, (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60));
    const accuracyScore = Math.max(0, 100 - Math.abs(actualHours - estimatedHours) / Math.max(1, estimatedHours) * 100);

    entry.estimatedHours += estimatedHours;
    entry.actualHours += actualHours;
    entry.accuracySum += accuracyScore;
    entry.count++;
  }

  const rawAgents: AgentEstimationMetrics[] = [...agentMap.entries()].map(([persona, data]) => {
    const avgEstimatedHours = data.estimatedHours / data.count;
    const avgActualHours = data.actualHours / data.count;
    const avgAccuracyScore = Math.round(data.accuracySum / data.count * 10) / 10;
    const deviation = ((avgActualHours - avgEstimatedHours) / Math.max(1, avgEstimatedHours)) * 100;
    let bias: 'overestimator' | 'underestimator' | 'accurate';
    if (Math.abs(deviation) > 20) {
      bias = avgActualHours > avgEstimatedHours ? 'overestimator' : 'underestimator';
    } else {
      bias = 'accurate';
    }
    return {
      agentPersona: persona,
      ticketsAnalyzed: data.count,
      avgAccuracyScore,
      avgEstimatedHours: Math.round(avgEstimatedHours * 10) / 10,
      avgActualHours: Math.round(avgActualHours * 10) / 10,
      bias,
    };
  });

  // Sort desc by avgAccuracyScore
  rawAgents.sort((a, b) => b.avgAccuracyScore - a.avgAccuracyScore);

  const mostAccurateAgent = rawAgents.length > 0 ? rawAgents[0].agentPersona : null;
  const leastAccurateAgent = rawAgents.length > 1 ? rawAgents[rawAgents.length - 1].agentPersona : null;
  const avgAccuracyScore = rawAgents.length > 0
    ? Math.round(rawAgents.reduce((s, a) => s + a.avgAccuracyScore, 0) / rawAgents.length * 10) / 10
    : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let aiSummary = FALLBACK_SUMMARY;

  try {
    const statsData = JSON.stringify({
      baselineHoursPerPoint: Math.round(baselineHoursPerPoint * 10) / 10,
      avgAccuracyScore,
      agents: rawAgents.slice(0, 5).map(a => ({ agent: a.agentPersona, avgAccuracyScore: a.avgAccuracyScore, bias: a.bias })),
    });
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Analyze agent estimation accuracy. Give 2-sentence summary. Output JSON: {aiSummary: string}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const parsed = JSON.parse(extractJSONFromText(text)) as { aiSummary: string };
    if (parsed.aiSummary) aiSummary = parsed.aiSummary;
  } catch (e) {
    console.warn('Agent estimation accuracy AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agentCount: rawAgents.length,
    ticketsAnalyzed: eligibleTickets.length,
    baselineHoursPerPoint: Math.round(baselineHoursPerPoint * 10) / 10,
    avgAccuracyScore,
    mostAccurateAgent,
    leastAccurateAgent,
    agents: rawAgents,
    aiSummary,
  };
}
