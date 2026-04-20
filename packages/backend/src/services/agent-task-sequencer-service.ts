import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface SequencedTicket {
  ticketId: string;
  title: string;
  priority: string | null;
  storyPoints: number | null;
  status: string;
  dueDate: string | null;
  score: number;
  rationale: string;
}

export interface AgentTaskSequence {
  agentName: string;
  ticketCount: number;
  sequence: SequencedTicket[];
}

export interface TaskSequenceReport {
  projectId: string;
  agentSequences: AgentTaskSequence[];
  totalAgents: number;
  totalTickets: number;
  generatedAt: string;
}

const ACTIVE_STATUSES = new Set(['backlog', 'in_progress', 'review', 'qa']);
const FALLBACK_RATIONALE = 'High priority — work on this next';

function scoreTicket(priority: string | null, storyPoints: number | null, status: string): number {
  let score = 0;

  switch (priority) {
    case 'critical': score += 40; break;
    case 'high': score += 30; break;
    case 'medium': score += 20; break;
    case 'low': score += 10; break;
    default: score += 5;
  }

  if (storyPoints !== null && storyPoints <= 2) {
    score += 15;
  } else if (storyPoints !== null && storyPoints >= 8) {
    score -= 10;
  }

  switch (status) {
    case 'in_progress': score += 25; break;
    case 'review': score += 20; break;
    case 'qa': score += 15; break;
  }

  return score;
}

export async function sequenceTasks(projectId: string): Promise<TaskSequenceReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      priority: tickets.priority,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
      storyPoints: tickets.storyPoints,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const filtered = allTickets.filter(
    (t) => t.assignedPersona != null && ACTIVE_STATUSES.has(t.status as string),
  );

  const agentMap = new Map<string, typeof filtered>();
  for (const ticket of filtered) {
    const persona = ticket.assignedPersona as string;
    if (!agentMap.has(persona)) agentMap.set(persona, []);
    agentMap.get(persona)!.push(ticket);
  }

  if (agentMap.size === 0) {
    return {
      projectId,
      agentSequences: [],
      totalAgents: 0,
      totalTickets: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  type ScoredTicket = {
    agentName: string;
    ticketId: string;
    title: string;
    priority: string | null;
    storyPoints: number | null;
    status: string;
    score: number;
  };

  const agentScoredMap = new Map<string, ScoredTicket[]>();
  for (const [agentName, agentTickets] of agentMap.entries()) {
    const scored: ScoredTicket[] = agentTickets.map((t) => ({
      agentName,
      ticketId: t.id,
      title: t.title,
      priority: t.priority as string | null,
      storyPoints: t.storyPoints,
      status: t.status as string,
      score: scoreTicket(t.priority as string | null, t.storyPoints, t.status as string),
    }));
    scored.sort((a, b) => b.score - a.score);
    agentScoredMap.set(agentName, scored);
  }

  // Gather top 3 per agent for AI rationale
  const top3Items: ScoredTicket[] = [];
  for (const scored of agentScoredMap.values()) {
    top3Items.push(...scored.slice(0, 3));
  }

  const rationales = new Map<string, string>();
  if (top3Items.length > 0) {
    try {
      const client = new Anthropic({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
      });

      const lines = top3Items
        .map(
          (t) =>
            `Agent: ${t.agentName}, Ticket: ${t.ticketId}, Priority: ${t.priority ?? 'none'}, Points: ${t.storyPoints ?? 'N/A'}, Status: ${t.status}`,
        )
        .join('\n');

      const prompt = `For each item below, provide a short rationale (<=10 words) for why this ticket should be worked on next. Output ONLY a JSON object where each key is "agentName|ticketId" and the value is the rationale string. No other text.\n\n${lines}`;

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'qwen/qwen3-6b',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [key, val] of Object.entries(parsed)) {
          rationales.set(key, val as string);
        }
      }
    } catch (e) {
      console.warn('Agent task sequencer AI rationale failed, using fallback:', e);
    }
  }

  const agentSequences: AgentTaskSequence[] = [];
  for (const [agentName, scored] of agentScoredMap.entries()) {
    const sequence: SequencedTicket[] = scored.map((t, idx) => ({
      ticketId: t.ticketId,
      title: t.title,
      priority: t.priority,
      storyPoints: t.storyPoints,
      status: t.status,
      dueDate: null,
      score: t.score,
      rationale:
        idx < 3
          ? (rationales.get(`${agentName}|${t.ticketId}`) ?? FALLBACK_RATIONALE)
          : FALLBACK_RATIONALE,
    }));
    agentSequences.push({ agentName, ticketCount: sequence.length, sequence });
  }

  agentSequences.sort((a, b) => a.agentName.localeCompare(b.agentName));

  const totalTickets = agentSequences.reduce((s, a) => s + a.ticketCount, 0);

  return {
    projectId,
    agentSequences,
    totalAgents: agentSequences.length,
    totalTickets,
    generatedAt: new Date().toISOString(),
  };
}
