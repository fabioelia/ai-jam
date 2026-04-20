import { db } from '../db/connection.js';
import { tickets, ticketNotes } from '../db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface CollaborationLink {
  fromAgent: string;
  toAgent: string;
  handoffCount: number;
  collaborationStrength: 'strong' | 'moderate' | 'weak';
}

export interface CollaborationNetworkReport {
  projectId: string;
  totalHandoffsAnalyzed: number;
  totalAgentsInNetwork: number;
  mostCollaborativeAgent: string | null;
  isolatedAgents: string[];
  strongLinks: CollaborationLink[];
  allLinks: CollaborationLink[];
  networkInsight: string;
  analyzedAt: string;
}

export interface HandoffNote {
  ticketId: string;
  handoffFrom: string | null;
  handoffTo: string | null;
}

export interface TicketRecord {
  id: string;
  assignedPersona: string | null;
}

export const FALLBACK_INSIGHT = 'Analyze handoff patterns to identify collaboration bottlenecks between agents.';

export function computeCollaborationStrength(count: number): CollaborationLink['collaborationStrength'] {
  if (count >= 5) return 'strong';
  if (count >= 2) return 'moderate';
  return 'weak';
}

export function computeNetwork(
  projectId: string,
  projectTickets: TicketRecord[],
  handoffNotes: HandoffNote[],
  networkInsight: string,
): Omit<CollaborationNetworkReport, 'analyzedAt'> {
  // Build ticket id -> assignedPersona map
  const ticketPersonaMap = new Map<string, string>();
  for (const t of projectTickets) {
    if (t.assignedPersona) ticketPersonaMap.set(t.id, t.assignedPersona);
  }

  const allPersonas = new Set<string>();
  for (const t of projectTickets) {
    if (t.assignedPersona) allPersonas.add(t.assignedPersona);
  }

  const validHandoffs = handoffNotes.filter((n) => n.handoffFrom != null);

  if (validHandoffs.length === 0) {
    return {
      projectId,
      totalHandoffsAnalyzed: 0,
      totalAgentsInNetwork: 0,
      mostCollaborativeAgent: null,
      isolatedAgents: [...allPersonas].sort(),
      strongLinks: [],
      allLinks: [],
      networkInsight,
    };
  }

  // Group by (fromAgent, toAgent) pair
  const pairCounts = new Map<string, { fromAgent: string; toAgent: string; count: number }>();

  for (const note of validHandoffs) {
    const fromAgent = note.handoffFrom as string;
    const toAgent = note.handoffTo ?? ticketPersonaMap.get(note.ticketId) ?? null;
    if (!toAgent) continue;

    const key = `${fromAgent}|||${toAgent}`;
    const existing = pairCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      pairCounts.set(key, { fromAgent, toAgent, count: 1 });
    }
  }

  // Build allLinks
  const allLinks: CollaborationLink[] = [];
  for (const pair of pairCounts.values()) {
    allLinks.push({
      fromAgent: pair.fromAgent,
      toAgent: pair.toAgent,
      handoffCount: pair.count,
      collaborationStrength: computeCollaborationStrength(pair.count),
    });
  }

  // Sort by handoffCount descending
  allLinks.sort((a, b) => b.handoffCount - a.handoffCount);

  const strongLinks = allLinks.filter((l) => l.collaborationStrength === 'strong');

  // Build set of agents involved in any handoff
  const agentsInHandoffs = new Set<string>();
  for (const link of allLinks) {
    agentsInHandoffs.add(link.fromAgent);
    agentsInHandoffs.add(link.toAgent);
  }

  // mostCollaborativeAgent = agent with highest total handoffs (from + to combined)
  const agentTotals = new Map<string, number>();
  for (const link of allLinks) {
    agentTotals.set(link.fromAgent, (agentTotals.get(link.fromAgent) ?? 0) + link.handoffCount);
    agentTotals.set(link.toAgent, (agentTotals.get(link.toAgent) ?? 0) + link.handoffCount);
  }

  let mostCollaborativeAgent: string | null = null;
  let maxTotal = 0;
  for (const [agent, total] of agentTotals.entries()) {
    if (total > maxTotal) {
      maxTotal = total;
      mostCollaborativeAgent = agent;
    }
  }

  // isolatedAgents = assignedPersonas from tickets who appear in 0 handoffs
  const isolatedAgents = [...allPersonas].filter((p) => !agentsInHandoffs.has(p)).sort();

  const totalAgentsInNetwork = agentsInHandoffs.size;
  const totalHandoffsAnalyzed = validHandoffs.length;

  return {
    projectId,
    totalHandoffsAnalyzed,
    totalAgentsInNetwork,
    mostCollaborativeAgent,
    isolatedAgents,
    strongLinks,
    allLinks,
    networkInsight,
  };
}

export async function analyzeCollaborationNetwork(projectId: string): Promise<CollaborationNetworkReport> {
  // Query all tickets to find assignedPersonas for the project
  const projectTickets = await db
    .select({
      id: tickets.id,
      assignedPersona: tickets.assignedPersona,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const ticketIds = projectTickets.map((t) => t.id);

  // Query ticketNotes where handoffFrom IS NOT NULL and ticket belongs to this project
  let handoffNotes: HandoffNote[] = [];

  if (ticketIds.length > 0) {
    const allNotes = await db
      .select({
        ticketId: ticketNotes.ticketId,
        handoffFrom: ticketNotes.handoffFrom,
        handoffTo: ticketNotes.handoffTo,
      })
      .from(ticketNotes)
      .where(isNotNull(ticketNotes.handoffFrom));

    const ticketIdSet = new Set(ticketIds);
    handoffNotes = allNotes.filter((n) => ticketIdSet.has(n.ticketId));
  }

  let networkInsight = FALLBACK_INSIGHT;
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const preview = computeNetwork(projectId, projectTickets, handoffNotes, FALLBACK_INSIGHT);
    const { allLinks, totalHandoffsAnalyzed, totalAgentsInNetwork, isolatedAgents } = preview;

    const summary = allLinks
      .slice(0, 10)
      .map(
        (l) =>
          `${l.fromAgent} → ${l.toAgent}: ${l.handoffCount} handoffs (${l.collaborationStrength})`,
      )
      .join('\n');

    const prompt = `Analyze this agent collaboration network and write a single paragraph about the collaboration patterns, key relationships, and any potential bottlenecks. Be concise and actionable.\n\nTotal handoffs: ${totalHandoffsAnalyzed}\nAgents in network: ${totalAgentsInNetwork}\nIsolated agents: ${isolatedAgents.join(', ') || 'none'}\n\nTop links:\n${summary}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) networkInsight = content;
  } catch (e) {
    console.warn('Agent collaboration network AI insight failed, using fallback:', e);
  }

  const result = computeNetwork(projectId, projectTickets, handoffNotes, networkInsight);
  return {
    ...result,
    analyzedAt: new Date().toISOString(),
  };
}
