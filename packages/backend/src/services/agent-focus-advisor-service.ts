import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, isNotNull, ne } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentFocusAdvice {
  agentName: string;
  inProgressCount: number;
  staleCount: number;
  focusRisk: 'overloaded' | 'stale' | 'idle' | 'balanced';
  topStaleTicket: { id: string; title: string } | null;
  recommendation: string;
}

export interface FocusAdvisorReport {
  projectId: string;
  agentAdvice: AgentFocusAdvice[];
  totalAgents: number;
  overloadedAgents: number;
  idleAgents: number;
  staleAgents: number;
  generatedAt: string;
}

const STALE_MS = 3 * 24 * 60 * 60 * 1000;

function getFallback(risk: 'overloaded' | 'stale' | 'idle'): string {
  if (risk === 'stale') return 'Clear stale tickets before starting new work';
  if (risk === 'overloaded') return 'Reduce concurrent tickets to regain focus';
  return 'Pick up next backlog ticket';
}

export async function adviseFocus(projectId: string): Promise<FocusAdvisorReport> {
  const now = Date.now();
  const staleThreshold = new Date(now - STALE_MS);

  const activeTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.projectId, projectId),
        ne(tickets.status, 'done'),
        isNotNull(tickets.assignedPersona),
      ),
    );

  if (activeTickets.length === 0) {
    return {
      projectId,
      agentAdvice: [],
      totalAgents: 0,
      overloadedAgents: 0,
      idleAgents: 0,
      staleAgents: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  type AgentBucket = {
    inProgressCount: number;
    staleTickets: { id: string; title: string; updatedAt: Date }[];
  };

  const agentMap = new Map<string, AgentBucket>();

  for (const ticket of activeTickets) {
    const persona = ticket.assignedPersona as string;
    if (!agentMap.has(persona)) {
      agentMap.set(persona, { inProgressCount: 0, staleTickets: [] });
    }
    const bucket = agentMap.get(persona)!;

    if (ticket.status === 'in_progress') {
      bucket.inProgressCount += 1;
    }

    const updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt) : new Date(0);
    if (updatedAt < staleThreshold) {
      bucket.staleTickets.push({ id: ticket.id, title: ticket.title ?? '', updatedAt });
    }
  }

  type Intermediate = {
    agentName: string;
    inProgressCount: number;
    staleCount: number;
    focusRisk: 'overloaded' | 'stale' | 'idle' | 'balanced';
    topStaleTicket: { id: string; title: string } | null;
  };

  const intermediates: Intermediate[] = [];

  for (const [agentName, bucket] of agentMap.entries()) {
    const { inProgressCount, staleTickets } = bucket;
    const staleCount = staleTickets.length;

    let focusRisk: 'overloaded' | 'stale' | 'idle' | 'balanced';
    if (inProgressCount >= 4) {
      focusRisk = 'overloaded';
    } else if (staleCount >= 2 && inProgressCount < 4) {
      focusRisk = 'stale';
    } else if (inProgressCount === 0) {
      focusRisk = 'idle';
    } else {
      focusRisk = 'balanced';
    }

    const sortedStale = staleTickets.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    const topStaleTicket = sortedStale.length > 0 ? { id: sortedStale[0].id, title: sortedStale[0].title } : null;

    intermediates.push({ agentName, inProgressCount, staleCount, focusRisk, topStaleTicket });
  }

  const nonBalanced = intermediates.filter((a) => a.focusRisk !== 'balanced').slice(0, 4);
  const recommendations = new Map<string, string>();

  if (nonBalanced.length > 0) {
    try {
      const client = new Anthropic({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
      });

      const agentLines = nonBalanced
        .map(
          (a) =>
            `Agent: ${a.agentName}, focusRisk: ${a.focusRisk}, inProgressCount: ${a.inProgressCount}, staleCount: ${a.staleCount}`,
        )
        .join('\n');

      const prompt = `You are an agile coach. For each agent below, recommend one concrete action in ≤12 words. Output ONLY a JSON object mapping agentName to advice string. No other text.

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
      console.warn('Agent focus advisor AI recommendations failed, using fallback:', e);
    }
  }

  const riskOrder = { overloaded: 0, stale: 1, idle: 2, balanced: 3 };

  const agentAdvice: AgentFocusAdvice[] = intermediates
    .map((a) => ({
      agentName: a.agentName,
      inProgressCount: a.inProgressCount,
      staleCount: a.staleCount,
      focusRisk: a.focusRisk,
      topStaleTicket: a.topStaleTicket,
      recommendation:
        a.focusRisk === 'balanced'
          ? ''
          : recommendations.get(a.agentName) ?? getFallback(a.focusRisk),
    }))
    .sort((a, b) => {
      const riskDiff = riskOrder[a.focusRisk] - riskOrder[b.focusRisk];
      if (riskDiff !== 0) return riskDiff;
      return a.agentName.localeCompare(b.agentName);
    });

  return {
    projectId,
    agentAdvice,
    totalAgents: agentAdvice.length,
    overloadedAgents: agentAdvice.filter((a) => a.focusRisk === 'overloaded').length,
    idleAgents: agentAdvice.filter((a) => a.focusRisk === 'idle').length,
    staleAgents: agentAdvice.filter((a) => a.focusRisk === 'stale').length,
    generatedAt: new Date().toISOString(),
  };
}
