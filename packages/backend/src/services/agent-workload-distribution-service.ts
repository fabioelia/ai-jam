import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { and, eq, isNotNull, or } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentWorkloadDistribution {
  agentPersona: string;
  totalActivity: number;
  peakHour: number;
  quietHour: number | null;
  burstScore: number;
  workPattern: 'burst' | 'steady' | 'mixed';
  hourlyBuckets: number[];
}

export interface WorkloadDistributionReport {
  projectId: string;
  analyzedAt: string;
  agents: AgentWorkloadDistribution[];
  summary: {
    totalAgents: number;
    peakSystemHour: number;
    burstiestAgent: string | null;
    steadiestAgent: string | null;
  };
  aiSummary: string;
}

const FALLBACK_SUMMARY = 'No significant workload distribution patterns detected.';

function buildAgentDistribution(agentPersona: string, hourlyBuckets: number[]): AgentWorkloadDistribution {
  const totalActivity = hourlyBuckets.reduce((s, v) => s + v, 0);
  const activeHours = hourlyBuckets.filter((v) => v > 0);
  const peakHour = hourlyBuckets.indexOf(Math.max(...hourlyBuckets));

  let quietHour: number | null = null;
  if (activeHours.length > 0) {
    const minActive = Math.min(...activeHours);
    quietHour = hourlyBuckets.indexOf(minActive);
  }

  const avgActiveHour = activeHours.length > 0 ? activeHours.reduce((s, v) => s + v, 0) / activeHours.length : 0;
  const maxHour = activeHours.length > 0 ? Math.max(...activeHours) : 0;
  const burstScore = avgActiveHour > 0 ? Math.round((maxHour / avgActiveHour) * 100) / 100 : 1.0;

  let workPattern: 'burst' | 'steady' | 'mixed';
  if (burstScore > 3.0) workPattern = 'burst';
  else if (burstScore <= 1.5) workPattern = 'steady';
  else workPattern = 'mixed';

  return { agentPersona, totalActivity, peakHour, quietHour, burstScore, workPattern, hourlyBuckets };
}

export async function analyzeWorkloadDistribution(projectId: string): Promise<WorkloadDistributionReport> {
  const now = new Date();

  const projectTickets = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNotNull(tickets.assignedPersona)));

  const notes = await db
    .select({
      authorId: ticketNotes.authorId,
      authorType: ticketNotes.authorType,
      handoffFrom: ticketNotes.handoffFrom,
      createdAt: ticketNotes.createdAt,
      ticketId: ticketNotes.ticketId,
    })
    .from(ticketNotes)
    .innerJoin(tickets, eq(ticketNotes.ticketId, tickets.id))
    .where(
      and(
        eq(tickets.projectId, projectId),
        or(eq(ticketNotes.authorType, 'agent'), isNotNull(ticketNotes.handoffFrom)),
      ),
    );

  if (projectTickets.length === 0 && notes.length === 0) {
    return {
      projectId,
      analyzedAt: now.toISOString(),
      agents: [],
      summary: { totalAgents: 0, peakSystemHour: 0, burstiestAgent: null, steadiestAgent: null },
      aiSummary: FALLBACK_SUMMARY,
    };
  }

  const agentHours = new Map<string, number[]>();

  const getOrInit = (persona: string) => {
    if (!agentHours.has(persona)) agentHours.set(persona, new Array(24).fill(0));
    return agentHours.get(persona)!;
  };

  for (const t of projectTickets) {
    const persona = t.assignedPersona!;
    const hour = new Date(t.updatedAt).getUTCHours();
    getOrInit(persona)[hour]++;
  }

  for (const n of notes) {
    const persona = n.authorId;
    const hour = new Date(n.createdAt).getUTCHours();
    getOrInit(persona)[hour]++;
  }

  const agents = Array.from(agentHours.entries())
    .map(([persona, buckets]) => buildAgentDistribution(persona, buckets))
    .filter((a) => a.totalActivity > 0)
    .sort((a, b) => b.totalActivity - a.totalActivity);

  // System-wide peak hour
  const systemHours = new Array(24).fill(0);
  for (const [, buckets] of agentHours) {
    for (let h = 0; h < 24; h++) systemHours[h] += buckets[h];
  }
  const peakSystemHour = systemHours.indexOf(Math.max(...systemHours));

  const burstiestAgent = agents.length > 0
    ? agents.reduce((a, b) => (b.burstScore > a.burstScore ? b : a)).agentPersona
    : null;
  const steadiestAgent = agents.length > 0
    ? agents.reduce((a, b) => (b.burstScore < a.burstScore ? b : a)).agentPersona
    : null;

  let aiSummary = FALLBACK_SUMMARY;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });
    const agentLines = agents
      .slice(0, 5)
      .map((a) => `${a.agentPersona}: total=${a.totalActivity}, peakHour=${a.peakHour}, pattern=${a.workPattern}, burstScore=${a.burstScore}`)
      .join('\n');
    const prompt = `Analyze agent workload distribution patterns. Focus on: which agents show bursty vs steady activity, whether peak hours are aligned or spread across the team, potential scheduling inefficiencies, recommendations for more even workload distribution.\n\nAgents:\n${agentLines}\n\nSystem peak hour: ${peakSystemHour}`;
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (text) aiSummary = text;
  } catch (e) {
    console.warn('Workload distribution AI summary failed, using fallback:', e);
  }

  return {
    projectId,
    analyzedAt: now.toISOString(),
    agents,
    summary: { totalAgents: agents.length, peakSystemHour, burstiestAgent, steadiestAgent },
    aiSummary,
  };
}
