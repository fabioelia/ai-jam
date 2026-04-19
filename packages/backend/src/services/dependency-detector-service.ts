import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq, and, notInArray, ne } from 'drizzle-orm';

export interface DependencySuggestion {
  ticketId: string;
  ticket: {
    id: string;
    title: string;
    status: string;
    priority: string;
  };
  relationship: 'blocks' | 'blocked_by' | 'related';
  confidence: number;
  reason: string;
}

let aiClient: Anthropic | null = null;

function getAIClient(): Anthropic {
  if (!aiClient) {
    aiClient = new Anthropic({
      apiKey: config.openrouterApiKey,
      baseURL: config.openrouterBaseUrl,
    });
  }
  return aiClient;
}

const SYSTEM_PROMPT = `You are an expert at identifying software ticket dependencies and relationships. Given a new ticket and a list of existing open tickets, identify which existing tickets are likely related to the new one.

Focus on:
1. **Semantic overlap**: Similar features, components, or domains
2. **Functional dependencies**: One ticket must be completed before the other
3. **Architectural coupling**: Tickets touching the same system boundaries

For each suggestion, provide:
- ticketId: the existing ticket ID
- relationship: "blocked_by" if new ticket depends on this one, "blocks" if this one depends on new ticket, "related" if they overlap or are coupled
- confidence: 0.0 to 1.0 (only include if >= 0.6)
- reason: brief explanation why (1 sentence)

Respond ONLY with valid JSON matching this exact schema:
[
  {
    "ticketId": "uuid-here",
    "relationship": "blocked_by",
    "confidence": 0.85,
    "reason": "Both tickets implement auth flow components that must be built in sequence"
  }
]

Include at most 5 suggestions. Order by confidence descending.`;

export async function suggestDependencies(
  projectId: string,
  title: string,
  description: string,
  excludeTicketId?: string,
): Promise<DependencySuggestion[]> {
  // Fetch all non-done tickets for this project
  const whereConditions = [
    eq(tickets.projectId, projectId),
    ne(tickets.status, 'done'),
  ];

  if (excludeTicketId) {
    whereConditions.push(ne(tickets.id, excludeTicketId));
  }

  const candidateTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
    })
    .from(tickets)
    .where(and(...whereConditions))
    .limit(100);

  if (candidateTickets.length === 0) {
    return [];
  }

  // Compressed ticket list for prompt: [id] TITLE (STATUS, PRIORITY)
  const ticketList = candidateTickets
    .map(t => `  - [${t.id.substring(0, 8)}] ${t.title} (${t.status}, ${t.priority})`)
    .join('\n');

  const userPrompt = `New ticket:
Title: ${title}
${description ? `Description:\n${description}` : ''}

Existing open tickets in the same project:
${ticketList}

Which of these tickets is related to or has a dependency relationship with the new ticket?`;

  const client = getAIClient();
  const response = await client.messages.create({
    model: config.aiModel,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const parsed = parseSuggestions(content);

  // Enrich with ticket details and filter by confidence
  const ticketMap = new Map(candidateTickets.map(t => [t.id, t]));

  return parsed
    .filter(s => s.confidence >= 0.6)
    .map(s => ({
      ...s,
      ticket: ticketMap.get(s.ticketId) || {
        id: s.ticketId,
        title: 'Unknown',
        status: 'unknown',
        priority: 'medium',
      },
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function parseSuggestions(content: string): Omit<DependencySuggestion, 'ticket'>[] {
  try {
    // Extract JSON from possible markdown wrapping
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : content.match(/\{[\s\S]*\}/)?.[0] || content;

    const parsed = JSON.parse(jsonText) as unknown[];

    return parsed.filter(item => typeof item === 'object' && item !== null).map(item => {
      const obj = item as Record<string, unknown>;
      return {
        ticketId: String(obj.ticketId || ''),
        relationship: ['blocks', 'blocked_by', 'related'].includes(String(obj.relationship))
          ? obj.relationship as DependencySuggestion['relationship']
          : 'related',
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.0,
        reason: String(obj.reason || ''),
      };
    });
  } catch {
    return [];
  }
}
