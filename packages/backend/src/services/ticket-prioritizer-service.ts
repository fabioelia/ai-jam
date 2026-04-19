import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface PrioritizedTicket {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  storyPoints: number | null;
  priorityScore: number;
  priorityRank: number;
  rationale: string;
  dimensions: {
    impact: number;
    urgency: number;
    dependency: number;
    readiness: number;
  };
}

export interface PrioritizationResult {
  projectId: string;
  totalTickets: number;
  rankedTickets: PrioritizedTicket[];
  rationaleSummary: string;
  analyzedAt: string;
}

const DEADLINE_KEYWORDS = ['urgent', 'asap', 'deadline', 'blocking', 'critical', 'before', 'must', 'blocker'];

function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['this', 'that', 'with', 'from', 'have', 'will', 'them', 'these', 'those', 'where', 'about'].includes(w));
}

function countDependents(ticket: { title: string }, allTickets: { title: string; description?: string | null }[]): number {
  const keywords = extractKeywords(ticket.title);
  if (keywords.length === 0) return 0;
  let count = 0;
  for (const other of allTickets) {
    if (other === ticket || !other.description) continue;
    const descLower = other.description.toLowerCase();
    if (descLower.includes(ticket.title.toLowerCase())) {
      count += 2;
      continue;
    }
    const matches = keywords.filter(kw => descLower.includes(kw));
    if (matches.length >= 2) {
      count += 1;
    }
  }
  return count;
}

function scoreImpact(ticket: { storyPoints: number | null; acceptanceCriteria: unknown }): number {
  const sp = ticket.storyPoints ?? 1;
  const spScore = Math.min(sp / 13, 1);
  const hasAC = Array.isArray(ticket.acceptanceCriteria) && ticket.acceptanceCriteria.length > 0;
  return Math.min(100, Math.round(spScore * 70 + (hasAC ? 30 : 0)));
}

function scoreUrgency(ticket: { description?: string | null; createdAt: Date }): number {
  const ageDays = (Date.now() - ticket.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const ageScore = Math.min(ageDays / 30, 1) * 60;
  const hasDeadline = ticket.description && DEADLINE_KEYWORDS.some(kw => ticket.description!.toLowerCase().includes(kw));
  return Math.min(100, Math.round(ageScore + (hasDeadline ? 40 : 0)));
}

function scoreDependency(ticket: { title: string }, allTickets: { title: string; description?: string | null }[]): number {
  const depCount = countDependents(ticket, allTickets);
  return Math.min(100, Math.round(depCount * 25));
}

function scoreReadiness(ticket: { description?: string | null; acceptanceCriteria: unknown; status: string }): number {
  let score = 0;
  if (ticket.description && ticket.description.length >= 50) score += 35;
  else if (ticket.description && ticket.description.length > 0) score += 15;
  if (Array.isArray(ticket.acceptanceCriteria) && ticket.acceptanceCriteria.length > 0) score += 35;
  if (ticket.status !== 'idea') score += 30;
  return Math.min(100, score);
}

export async function prioritizeTickets(projectId: string): Promise<PrioritizationResult> {
  const allTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
  const backlogTickets = allTickets.filter(t => t.status !== 'done' && t.status !== 'in_progress');

  if (backlogTickets.length === 0) {
    return {
      projectId,
      totalTickets: 0,
      rankedTickets: [],
      rationaleSummary: 'No backlog tickets to prioritize.',
      analyzedAt: new Date().toISOString(),
    };
  }

  // Score each ticket
  const scored = backlogTickets.map(ticket => {
    const impact = scoreImpact(ticket);
    const urgency = scoreUrgency(ticket);
    const dependency = scoreDependency(ticket, backlogTickets);
    const readiness = scoreReadiness(ticket);
    const priorityScore = Math.round(impact * 0.30 + urgency * 0.25 + dependency * 0.25 + readiness * 0.20);

    return {
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      ticketStatus: ticket.status,
      storyPoints: ticket.storyPoints,
      priorityScore: Math.min(100, priorityScore),
      priorityRank: 0 as number,
      dimensions: { impact, urgency, dependency, readiness },
      _createdAt: ticket.createdAt,
      _description: ticket.description ?? '',
      _acceptanceCriteria: ticket.acceptanceCriteria,
    };
  });

  // Sort by priorityScore descending
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  // Try AI re-ordering for top 10
  let rationaleSummary = '';
  let aiReorder: string[] | null = null;

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const top10 = scored.slice(0, 10);
    const ticketSummaries = top10.map((t, i) =>
      `${i + 1}. [${t.ticketId.substring(0, 8)}] "${t.ticketTitle}" | status: ${t.ticketStatus}, score: ${t.priorityScore}`
    ).join('\n');

    const prompt = `You are prioritizing a project backlog. Here are the top 10 tickets by heuristic score:

${ticketSummaries}

Return ONLY a JSON object with:
{
  "topOrder": ["<ticketId>", "<ticketId>", ...],
  "rationaleSummary": "<1-2 sentence summary of why top 3 tickets rank highest>"
}

Rules:
- Return only a re-ordered subset of the top 5 ticket IDs (fewer is fine if you disagree with some)
- Keep ticket IDs exactly as shown (first 12 chars minimum)
- rationaleSummary: explain the main priority drivers (urgency, dependencies, impact)
`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    const parsed = JSON.parse(jsonText) as {
      topOrder: string[];
      rationaleSummary: string;
    };

    if (parsed.topOrder && parsed.topOrder.length > 0) {
      aiReorder = parsed.topOrder;
      rationaleSummary = parsed.rationaleSummary || '';
    }
  } catch (e) {
    console.warn('AI prioritization failed, using heuristic ranking:', e);
    rationaleSummary = 'AI unavailable — showing heuristic ranking';
  }

  // AI re-order top tickets if we got results
  if (aiReorder && aiReorder.length > 0) {
    const reordered: typeof scored = [];
    const remaining = [...scored];

    for (const id of aiReorder) {
      const idx = remaining.findIndex(s => s.ticketId.startsWith(id) || s.ticketId === id);
      if (idx !== -1) {
        reordered.push(remaining.splice(idx, 1)[0]);
      }
    }
    reordered.push(...remaining);

    for (let i = 0; i < reordered.length; i++) {
      reordered[i].priorityRank = i + 1;
    }

    scored.length = 0;
    scored.push(...reordered);
  } else {
    for (let i = 0; i < scored.length; i++) {
      scored[i].priorityRank = i + 1;
    }
  }

  // Assign rationales
  const rankedTickets: PrioritizedTicket[] = scored.map(s => {
    let rationale = '';
    if (s.priorityRank <= 3) {
      const drivers: string[] = [];
      if (s.dimensions.impact >= 60) drivers.push('high impact');
      if (s.dimensions.urgency >= 60) drivers.push('time-sensitive');
      if (s.dimensions.dependency >= 50) drivers.push('many tickets depend on it');
      if (s.dimensions.readiness >= 80) drivers.push('well-defined and ready');
      rationale = `Ranked #${s.priorityRank}: ${drivers.length > 0 ? drivers.join(', ') : 'balanced priority'}`;
    } else {
      rationale = `Lower priority due to ${s.dimensions.readiness < 50 ? 'incomplete definition' : 'lower impact and urgency'}`;
    }

    const { _createdAt, _description, _acceptanceCriteria, ...clean } = s;
    return { ...clean, rationale };
  });

  if (!rationaleSummary) {
    rationaleSummary = `Top priority: ${rankedTickets[0]?.ticketTitle ?? 'n/a'}. ${rankedTickets.length} backlog items analyzed.`;
  }

  return {
    projectId,
    totalTickets: backlogTickets.length,
    rankedTickets,
    rationaleSummary,
    analyzedAt: new Date().toISOString(),
  };
}
