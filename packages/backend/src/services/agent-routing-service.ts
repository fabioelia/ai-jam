import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, isNull, ne, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface AgentRouting {
  agentName: string;
  score: number;
  reason: string;
}

export interface RoutingRecommendation {
  ticketId: string;
  ticketTitle: string;
  ticketPriority: string;
  rankedAgents: AgentRouting[];
}

export interface RoutingReport {
  projectId: string;
  unassignedCount: number;
  recommendations: RoutingRecommendation[];
  rationale: string;
  analyzedAt: string;
}

type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

const ADJACENT_PRIORITIES: Record<string, TicketPriority[]> = {
  critical: ['high'],
  high: ['critical', 'medium'],
  medium: ['high', 'low'],
  low: ['medium'],
};

export async function analyzeRouting(projectId: string): Promise<RoutingReport> {
  // Fetch all project tickets
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      priority: tickets.priority,
      storyPoints: tickets.storyPoints,
      status: tickets.status,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  // Unassigned tickets: assignedPersona IS NULL and status != 'done'
  const unassignedTickets = allTickets.filter(
    (t) => t.assignedPersona === null && t.status !== 'done',
  );

  // All agents = distinct non-null assignedPersona values
  const agentSet = new Set<string>();
  for (const t of allTickets) {
    if (t.assignedPersona !== null) {
      agentSet.add(t.assignedPersona);
    }
  }
  const agents = Array.from(agentSet);

  if (unassignedTickets.length === 0) {
    return {
      projectId,
      unassignedCount: 0,
      recommendations: [],
      rationale: await generateRationale([], agents, 'No unassigned tickets to route.'),
      analyzedAt: new Date().toISOString(),
    };
  }

  const recommendations: RoutingRecommendation[] = [];

  for (const ticket of unassignedTickets) {
    const rankedAgents: AgentRouting[] = [];

    if (agents.length === 0) {
      recommendations.push({
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        ticketPriority: ticket.priority,
        rankedAgents: [],
      });
      continue;
    }

    for (const agentName of agents) {
      const agentTickets = allTickets.filter((t) => t.assignedPersona === agentName);
      const doneTickets = agentTickets.filter((t) => t.status === 'done');
      const activeTickets = agentTickets.filter((t) => t.status !== 'done');

      // Priority match score
      const donePriorities = doneTickets.map((t) => t.priority);
      let priorityMatchScore = 0;
      if (donePriorities.includes(ticket.priority)) {
        priorityMatchScore = 2;
      } else {
        const adjacent = ADJACENT_PRIORITIES[ticket.priority] || [];
        if (adjacent.some((p) => donePriorities.includes(p))) {
          priorityMatchScore = 1;
        }
      }

      // Load penalty
      const loadPenalty = activeTickets.length * 0.5;

      const score = priorityMatchScore - loadPenalty;

      // Build reason string
      const samePriorityCount = doneTickets.filter((t) => t.priority === ticket.priority).length;
      const reason = `Handled ${samePriorityCount} ${ticket.priority} tickets, current load: ${activeTickets.length} tickets`;

      rankedAgents.push({ agentName, score, reason });
    }

    // Sort by score desc, take top 2
    rankedAgents.sort((a, b) => b.score - a.score);
    const top2 = rankedAgents.slice(0, 2);

    recommendations.push({
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      ticketPriority: ticket.priority,
      rankedAgents: top2,
    });
  }

  const rationale = await generateRationale(recommendations, agents);

  return {
    projectId,
    unassignedCount: unassignedTickets.length,
    recommendations,
    rationale,
    analyzedAt: new Date().toISOString(),
  };
}

async function generateRationale(
  recommendations: RoutingRecommendation[],
  agents: string[],
  hint?: string,
): Promise<string> {
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `You are an AI project management assistant. Based on the following agent routing recommendations, provide a 2-3 sentence routing strategy summary.

Agents available: ${agents.join(', ') || 'none'}
Unassigned tickets to route: ${recommendations.length}
${hint ? `Note: ${hint}` : ''}
${
  recommendations.length > 0
    ? `Sample recommendations:\n${recommendations
        .slice(0, 3)
        .map(
          (r) =>
            `- Ticket "${r.ticketTitle}" (${r.ticketPriority}): top agent = ${r.rankedAgents[0]?.agentName || 'none'} (score: ${r.rankedAgents[0]?.score?.toFixed(2) || 'N/A'})`,
        )
        .join('\n')}`
    : ''
}

Provide a brief, actionable 2-3 sentence routing strategy.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) return content;
  } catch (e) {
    console.warn('AI routing rationale failed, using heuristic fallback:', e);
  }

  return 'Routing based on agent capacity and priority matching';
}
