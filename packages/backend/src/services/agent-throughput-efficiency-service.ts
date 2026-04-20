import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentThroughputMetrics {
  agentPersona: string;
  completedTickets: number;
  totalTickets: number;
  avgCycleTimeHours: number;
  throughputScore: number;
  rank: number;
  recommendation: string;
}

export interface ThroughputEfficiencyReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentThroughputMetrics[];
  topAgent: string | null;
  bottomAgent: string | null;
  avgThroughputScore: number;
  summary: string;
  recommendations: string[];
}

const FALLBACK_SUMMARY = 'Review agent throughput to identify bottlenecks and optimize ticket completion rates.';
const FALLBACK_RECOMMENDATIONS = ['Reassign stalled tickets to high-throughput agents to improve team velocity.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function calcThroughputScore(completedTickets: number, totalTickets: number, avgCycleTimeHours: number): number {
  if (totalTickets === 0 || completedTickets === 0) return 0;
  const completionRate = completedTickets / totalTickets;
  // Normalize cycle time: 0h → 100, 240h (10 days) → 0
  const cycleEfficiency = Math.max(0, 100 - (avgCycleTimeHours / 240) * 100);
  const score = completionRate * 60 + cycleEfficiency * 0.4;
  return Math.round(Math.min(100, score) * 10) / 10;
}

function recommendationForScore(score: number): string {
  if (score >= 75) return 'High throughput — consider assigning more complex or high-priority tickets.';
  if (score >= 50) return 'Moderate throughput — look for ways to reduce cycle time on in-progress tickets.';
  if (score >= 25) return 'Below-average throughput — review workload and unblock stalled tickets.';
  return 'Low throughput — investigate blockers and redistribute work to improve velocity.';
}

export async function analyzeAgentThroughputEfficiency(projectId: string): Promise<ThroughputEfficiencyReport> {
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
      agents: [],
      topAgent: null,
      bottomAgent: null,
      avgThroughputScore: 0,
      summary: FALLBACK_SUMMARY,
      recommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Group by agent
  const agentMap = new Map<string, { createdAt: Date; updatedAt: Date; status: string }[]>();
  for (const t of assignedTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push({ createdAt: t.createdAt, updatedAt: t.updatedAt, status: t.status });
  }

  const rawAgents: Omit<AgentThroughputMetrics, 'rank'>[] = [];

  for (const [persona, agentTickets] of agentMap.entries()) {
    const totalTickets = agentTickets.length;
    const doneTickets = agentTickets.filter(t => t.status === 'done');
    const completedTickets = doneTickets.length;

    let avgCycleTimeHours = 0;
    if (doneTickets.length > 0) {
      const totalCycleMs = doneTickets.reduce((sum, t) => {
        const cycleMs = t.updatedAt.getTime() - t.createdAt.getTime();
        return sum + Math.max(0, cycleMs);
      }, 0);
      avgCycleTimeHours = totalCycleMs / doneTickets.length / (1000 * 60 * 60);
    }

    const throughputScore = calcThroughputScore(completedTickets, totalTickets, avgCycleTimeHours);

    rawAgents.push({
      agentPersona: persona,
      completedTickets,
      totalTickets,
      avgCycleTimeHours: Math.round(avgCycleTimeHours * 10) / 10,
      throughputScore,
      recommendation: recommendationForScore(throughputScore),
    });
  }

  // Sort by throughputScore desc → assign rank
  rawAgents.sort((a, b) => b.throughputScore - a.throughputScore);
  const agents: AgentThroughputMetrics[] = rawAgents.map((a, i) => ({ ...a, rank: i + 1 }));

  const topAgent = agents.length > 0 ? agents[0].agentPersona : null;
  const bottomAgent = agents.length > 1 ? agents[agents.length - 1].agentPersona : null;
  const avgThroughputScore = agents.length > 0
    ? Math.round((agents.reduce((sum, a) => sum + a.throughputScore, 0) / agents.length) * 10) / 10
    : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let summary = FALLBACK_SUMMARY;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify(agents.slice(0, 5).map(a => ({
      agent: a.agentPersona,
      rank: a.rank,
      throughputScore: a.throughputScore,
      completedTickets: a.completedTickets,
      avgCycleTimeHours: a.avgCycleTimeHours,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent throughput efficiency. Give summary (2 sentences: overall throughput health + top vs bottom agent) and 2-3 recommendations. Output JSON: {summary: string, recommendations: string[]}.\n\n${statsData}`,
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const jsonStr = extractJSONFromText(text);
    const parsed = JSON.parse(jsonStr) as { summary: string; recommendations: string[] };
    if (parsed.summary) summary = parsed.summary;
    if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
      recommendations = parsed.recommendations;
    }
  } catch (e) {
    console.warn('Agent throughput efficiency AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents,
    topAgent,
    bottomAgent,
    avgThroughputScore,
    summary,
    recommendations,
  };
}
