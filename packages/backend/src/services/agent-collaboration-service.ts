import { db } from '../db/connection.js';
import { tickets, agentSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface CollaborationPair {
  primaryAgent: string;
  secondaryAgent: string;
  collaborationScore: number;
  rationale: string;
  suggestedSplit: string;
}

export interface CollaborationTicket {
  ticketId: string;
  ticketTitle: string;
  ticketPriority: string;
  detectedSpecializations: string[];
  recommendedPairs: CollaborationPair[];
}

export interface CollaborationReport {
  projectId: string;
  complexTickets: CollaborationTicket[];
  analyzedAt: string;
}

export function detectSpecializations(text: string): string[] {
  const lower = text.toLowerCase();
  const specs: string[] = [];
  if (/auth|security|token|permission/.test(lower)) specs.push('security');
  if (/database|schema|migration|query/.test(lower)) specs.push('database');
  if (/frontend|ui|modal|component|page/.test(lower)) specs.push('frontend');
  if (/api|route|endpoint|backend/.test(lower)) specs.push('backend');
  if (/test|qa|verify|spec/.test(lower)) specs.push('testing');
  if (/design|ux|layout|style/.test(lower)) specs.push('design');
  return specs;
}

export function scoreCollaborationPair(
  primaryAgent: string,
  secondaryAgent: string,
  ticketSpecs: string[],
): number {
  const primarySpecs = detectSpecializations(primaryAgent);
  const secondarySpecs = detectSpecializations(secondaryAgent);

  let score = 40;
  if (ticketSpecs[0] && primarySpecs.includes(ticketSpecs[0])) score += 30;
  if (ticketSpecs[1] && secondarySpecs.includes(ticketSpecs[1])) score += 20;

  const pPrimary = primarySpecs[0];
  const sPrimary = secondarySpecs[0];
  if (pPrimary && sPrimary) {
    if (pPrimary !== sPrimary) score += 10;
    else score -= 10;
  }

  return Math.min(100, Math.max(0, score));
}

async function generatePairRationale(
  primaryAgent: string,
  secondaryAgent: string,
  ticketTitle: string,
  specs: string[],
): Promise<string> {
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Ticket "${ticketTitle}" requires ${specs.join(', ')} expertise. Recommend ${primaryAgent} as primary and ${secondaryAgent} as secondary because...`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (content) return content;
  } catch (e) {
    console.warn('AI collaboration rationale failed, using heuristic fallback:', e);
  }

  return `${primaryAgent} leads ${specs[0] ?? 'primary'}, ${secondaryAgent} covers ${specs[1] ?? 'secondary'}`;
}

export async function analyzeCollaboration(projectId: string): Promise<CollaborationReport> {
  const allTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      priority: tickets.priority,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const eligibleTickets = allTickets.filter((t) => {
    if (t.status === 'done') return false;
    const longDesc = (t.description?.length ?? 0) > 100;
    const highPriority = t.priority === 'critical' || t.priority === 'high';
    return longDesc || highPriority;
  });

  const sessionAgents = await db
    .selectDistinct({ name: agentSessions.personaType })
    .from(agentSessions)
    .innerJoin(tickets, eq(agentSessions.ticketId, tickets.id))
    .where(eq(tickets.projectId, projectId));

  const agents = sessionAgents.map((r) => r.name).filter(Boolean) as string[];

  const complexTickets: CollaborationTicket[] = [];

  for (const ticket of eligibleTickets) {
    const text = `${ticket.title} ${ticket.description ?? ''}`;
    const specs = detectSpecializations(text);

    if (specs.length < 2) continue;
    if (agents.length < 2) continue;

    const pairs: CollaborationPair[] = [];
    for (let i = 0; i < agents.length; i++) {
      for (let j = 0; j < agents.length; j++) {
        if (i === j) continue;
        const score = scoreCollaborationPair(agents[i], agents[j], specs);
        const rationale = await generatePairRationale(agents[i], agents[j], ticket.title, specs);
        const suggestedSplit = `${agents[i]} handles ${specs[0]}, ${agents[j]} handles ${specs[1]}`;
        pairs.push({
          primaryAgent: agents[i],
          secondaryAgent: agents[j],
          collaborationScore: score,
          rationale,
          suggestedSplit,
        });
      }
    }

    pairs.sort((a, b) => b.collaborationScore - a.collaborationScore);
    const top2 = pairs.slice(0, 2);

    complexTickets.push({
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      ticketPriority: ticket.priority,
      detectedSpecializations: specs,
      recommendedPairs: top2,
    });
  }

  return {
    projectId,
    complexTickets,
    analyzedAt: new Date().toISOString(),
  };
}
