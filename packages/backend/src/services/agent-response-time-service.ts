import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentResponseProfile {
  agentName: string;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  ticketsActedOn: number;
  unstartedTickets: number;
  responseCategory: 'fast' | 'normal' | 'slow';
  recommendation: string;
}

export interface ResponseTimeReport {
  projectId: string;
  agentProfiles: AgentResponseProfile[];
  totalAgents: number;
  slowAgents: number;
  fastAgents: number;
  avgProjectResponseMs: number;
  generatedAt: string;
}

const FAST_THRESHOLD = 86_400_000;    // 24h
const SLOW_THRESHOLD = 259_200_000;   // 72h

function getFallback(category: 'fast' | 'normal' | 'slow'): string {
  if (category === 'slow') return 'Reduce ticket queue to improve response times';
  return 'Good response pattern — maintain current load';
}

export async function profileResponseTimes(projectId: string): Promise<ResponseTimeReport> {
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

  if (allTickets.length === 0) {
    return {
      projectId,
      agentProfiles: [],
      totalAgents: 0,
      slowAgents: 0,
      fastAgents: 0,
      avgProjectResponseMs: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  type AgentBucket = {
    responseTimes: number[];
    unstarted: number;
  };

  const agentMap = new Map<string, AgentBucket>();

  for (const ticket of allTickets) {
    const persona = ticket.assignedPersona as string;
    if (!agentMap.has(persona)) {
      agentMap.set(persona, { responseTimes: [], unstarted: 0 });
    }
    const bucket = agentMap.get(persona)!;

    if (ticket.status === 'backlog') {
      bucket.unstarted += 1;
    } else {
      const createdAt = ticket.createdAt ? new Date(ticket.createdAt).getTime() : 0;
      const updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt).getTime() : 0;
      bucket.responseTimes.push(updatedAt - createdAt);
    }
  }

  type Intermediate = {
    agentName: string;
    avgResponseTimeMs: number;
    minResponseTimeMs: number;
    maxResponseTimeMs: number;
    ticketsActedOn: number;
    unstartedTickets: number;
    responseCategory: 'fast' | 'normal' | 'slow';
  };

  const intermediates: Intermediate[] = [];

  for (const [agentName, bucket] of agentMap.entries()) {
    const { responseTimes, unstarted } = bucket;
    const ticketsActedOn = responseTimes.length;

    if (ticketsActedOn === 0 && unstarted === 0) continue;

    const avgResponseTimeMs = ticketsActedOn > 0
      ? responseTimes.reduce((s, v) => s + v, 0) / ticketsActedOn
      : 0;
    const minResponseTimeMs = ticketsActedOn > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTimeMs = ticketsActedOn > 0 ? Math.max(...responseTimes) : 0;

    let responseCategory: 'fast' | 'normal' | 'slow';
    if (unstarted > ticketsActedOn) {
      responseCategory = 'slow';
    } else if (avgResponseTimeMs > SLOW_THRESHOLD) {
      responseCategory = 'slow';
    } else if (avgResponseTimeMs < FAST_THRESHOLD) {
      responseCategory = 'fast';
    } else {
      responseCategory = 'normal';
    }

    intermediates.push({
      agentName,
      avgResponseTimeMs,
      minResponseTimeMs,
      maxResponseTimeMs,
      ticketsActedOn,
      unstartedTickets: unstarted,
      responseCategory,
    });
  }

  const slowOnes = intermediates.filter((a) => a.responseCategory === 'slow').slice(0, 3);
  const recommendations = new Map<string, string>();

  if (slowOnes.length > 0) {
    try {
      const client = new Anthropic({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
      });

      const agentLines = slowOnes
        .map(
          (a) =>
            `Agent: ${a.agentName}, avgResponseTime: ${(a.avgResponseTimeMs / 3_600_000).toFixed(1)}h, unstartedTickets: ${a.unstartedTickets}, ticketsActedOn: ${a.ticketsActedOn}`,
        )
        .join('\n');

      const prompt = `You are an agile coach. For each agent below, suggest one action in ≤12 words to improve response time. Output ONLY a JSON object mapping agentName to advice string. No other text.

${agentLines}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [name, rec] of Object.entries(parsed)) {
          recommendations.set(name, rec as string);
        }
      }
    } catch (e) {
      console.warn('Agent response time AI recommendations failed, using fallback:', e);
    }
  }

  const categoryOrder = { slow: 0, normal: 1, fast: 2 };

  const agentProfiles: AgentResponseProfile[] = intermediates
    .map((a) => ({
      agentName: a.agentName,
      avgResponseTimeMs: a.avgResponseTimeMs,
      minResponseTimeMs: a.minResponseTimeMs,
      maxResponseTimeMs: a.maxResponseTimeMs,
      ticketsActedOn: a.ticketsActedOn,
      unstartedTickets: a.unstartedTickets,
      responseCategory: a.responseCategory,
      recommendation:
        a.responseCategory === 'slow'
          ? (recommendations.get(a.agentName) ?? getFallback('slow'))
          : getFallback(a.responseCategory),
    }))
    .sort((a, b) => {
      const catDiff = categoryOrder[a.responseCategory] - categoryOrder[b.responseCategory];
      if (catDiff !== 0) return catDiff;
      return b.avgResponseTimeMs - a.avgResponseTimeMs;
    });

  const totalAvg =
    agentProfiles.length > 0
      ? agentProfiles.reduce((s, a) => s + a.avgResponseTimeMs, 0) / agentProfiles.length
      : 0;

  return {
    projectId,
    agentProfiles,
    totalAgents: agentProfiles.length,
    slowAgents: agentProfiles.filter((a) => a.responseCategory === 'slow').length,
    fastAgents: agentProfiles.filter((a) => a.responseCategory === 'fast').length,
    avgProjectResponseMs: totalAvg,
    generatedAt: new Date().toISOString(),
  };
}
