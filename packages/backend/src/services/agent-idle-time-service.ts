import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export type IdleStatus = 'overloaded' | 'active' | 'underutilized' | 'idle';

export interface AgentIdleTimeStats {
  agentPersona: string;
  totalTickets: number;
  idleGapHours: number;
  longestIdleGap: number;
  utilizationRate: number;
  status: IdleStatus;
}

export interface AgentIdleTimeAnalysis {
  projectId: string;
  analyzedAt: string;
  agents: AgentIdleTimeStats[];
  avgIdleGapHours: number;
  mostIdleAgent: string | null;
  totalIdleRisk: number;
  overallUtilization: number;
  summary: string;
  recommendations: string[];
}

const FALLBACK_SUMMARY = 'Strengthen inter-agent workload distribution by assigning queued tickets to idle agents.';
const FALLBACK_RECOMMENDATIONS = ['Assign backlog tickets to underutilized agents to reduce idle gaps.'];

function extractJSONFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text;
}

function statusOrder(s: IdleStatus): number {
  switch (s) {
    case 'idle': return 0;
    case 'underutilized': return 1;
    case 'active': return 2;
    case 'overloaded': return 3;
  }
}

export async function analyzeAgentIdleTime(projectId: string): Promise<AgentIdleTimeAnalysis> {
  const now = new Date();

  const allTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
      createdAt: tickets.createdAt,
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
      avgIdleGapHours: 0,
      mostIdleAgent: null,
      totalIdleRisk: 0,
      overallUtilization: 0,
      summary: FALLBACK_SUMMARY,
      recommendations: FALLBACK_RECOMMENDATIONS,
    };
  }

  // Group tickets by agent
  const agentMap = new Map<string, Date[]>();
  for (const t of assignedTickets) {
    const persona = t.assignedPersona!;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(t.createdAt);
  }

  const agents: AgentIdleTimeStats[] = [];

  for (const [persona, createdAts] of agentMap.entries()) {
    const totalTickets = Number(createdAts.length);
    const sorted = [...createdAts].sort((a, b) => a.getTime() - b.getTime());

    let idleGapHours = 0;
    let longestIdleGap = 0;

    if (sorted.length >= 2) {
      let totalGapMs = 0;
      for (let i = 1; i < sorted.length; i++) {
        const gapMs = sorted[i].getTime() - sorted[i - 1].getTime();
        totalGapMs += gapMs;
        const gapHours = gapMs / (1000 * 60 * 60);
        if (gapHours > longestIdleGap) longestIdleGap = gapHours;
      }
      idleGapHours = totalGapMs / (1000 * 60 * 60) / (sorted.length - 1);
    }

    const firstTicketDate = sorted[0];
    const daysSinceFirstTicket = Math.max(1, (now.getTime() - firstTicketDate.getTime()) / (1000 * 60 * 60 * 24));
    const ticketsPerDay = totalTickets / daysSinceFirstTicket;
    const utilizationRate = Math.min(100, (ticketsPerDay / 2) * 100);

    let status: IdleStatus;
    if (utilizationRate >= 80) status = 'overloaded';
    else if (utilizationRate >= 50) status = 'active';
    else if (utilizationRate >= 20) status = 'underutilized';
    else status = 'idle';

    agents.push({
      agentPersona: persona,
      totalTickets,
      idleGapHours: Math.round(idleGapHours * 10) / 10,
      longestIdleGap: Math.round(longestIdleGap * 10) / 10,
      utilizationRate: Math.round(utilizationRate * 10) / 10,
      status,
    });
  }

  // Sort: idle → underutilized → active → overloaded; within tier by idleGapHours desc
  agents.sort((a, b) => {
    const statusDiff = statusOrder(a.status) - statusOrder(b.status);
    return statusDiff !== 0 ? statusDiff : b.idleGapHours - a.idleGapHours;
  });

  const agentsWithTickets = agents.filter(a => a.totalTickets > 0);
  const avgIdleGapHours = agentsWithTickets.length > 0
    ? agentsWithTickets.reduce((sum, a) => sum + a.idleGapHours, 0) / agentsWithTickets.length
    : 0;

  const mostIdleAgent = agentsWithTickets.length > 0
    ? agentsWithTickets.reduce((max, a) => a.idleGapHours > max.idleGapHours ? a : max).agentPersona
    : null;

  const totalIdleRisk = agents.filter(a => a.status === 'idle' || a.status === 'underutilized').length;
  const overallUtilization = agents.length > 0
    ? agents.reduce((sum, a) => sum + a.utilizationRate, 0) / agents.length
    : 0;

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  let summary = FALLBACK_SUMMARY;
  let recommendations = FALLBACK_RECOMMENDATIONS;

  try {
    const statsData = JSON.stringify(agents.map(a => ({
      agent: a.agentPersona,
      status: a.status,
      utilizationRate: a.utilizationRate,
      idleGapHours: a.idleGapHours,
    })));
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Analyze agent idle time. Give summary (2 sentences: overall health + worst agent) and 2-3 recommendations to improve utilization. Output JSON: {summary: string, recommendations: string[]}.\n\n${statsData}`,
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
    console.warn('Agent idle time AI failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents,
    avgIdleGapHours: Math.round(avgIdleGapHours * 10) / 10,
    mostIdleAgent,
    totalIdleRisk,
    overallUtilization: Math.round(overallUtilization * 10) / 10,
    summary,
    recommendations,
  };
}
