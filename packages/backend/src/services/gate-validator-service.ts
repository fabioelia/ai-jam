import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/connection.js';
import { tickets, ticketNotes, comments } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import type { TicketStatus } from '@ai-jam/shared';
import type { GateValidationResult } from '@ai-jam/shared';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: config.openrouterApiKey,
      baseURL: config.openrouterBaseUrl,
    });
  }
  return client;
}

const SYSTEM_PROMPT = `You are an AI quality gate validator for a software project management tool.

Given a ticket's details and its transition target, evaluate whether the ticket meets the requirements for that transition.

Analyze:
1. Does the ticket description contain acceptance criteria (lines with "- [ ]" or "Success Criteria" section)?
2. Are there agent handoff notes documenting work done?
3. Are there comments with relevant status updates?
4. Does the work described match what's needed for the requested transition?

Transition stages: backlog → in_progress → review → qa → acceptance → done
- in_progress→review: Code should be written and ready for review
- review→qa: Code review should be complete, ready for testing
- qa→acceptance: Tests should pass, ready for stakeholder acceptance
- acceptance→done: Acceptance criteria signed off

Respond ONLY with valid JSON matching this schema:
{
  "approved": boolean,
  "score": number,
  "assessment": "1-2 sentence summary of readiness",
  "gaps": ["specific gap 1", "specific gap 2"],
  "checklist": [
    { "item": "acceptance criterion text", "met": boolean }
  ]
}

Score: 0.0=completely unready, 0.5=partially ready, 1.0=fully ready
If no acceptance criteria found, infer checklist from ticket description and transition type.`;

function extractJSON(content: string): string | null {
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
}

export async function validateTicketForTransition(
  ticketId: string,
  targetStatus: TicketStatus,
): Promise<GateValidationResult> {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  const notes = await db.select().from(ticketNotes).where(eq(ticketNotes.ticketId, ticketId));
  const ticketComments = await db.select().from(comments).where(eq(comments.ticketId, ticketId));

  const handoffNotes = notes
    .filter((n) => n.handoffFrom || n.handoffTo)
    .map((n) => `[${n.handoffFrom ?? '?'} → ${n.handoffTo ?? '?'}]: ${n.content.slice(0, 500)}`)
    .join('\n\n');

  const commentSummary = ticketComments
    .slice(-5)
    .map((c) => `- ${c.body.slice(0, 200)}`)
    .join('\n');

  const prompt = `Ticket: ${ticket.title}
Status: ${ticket.status} → requested: ${targetStatus}
Priority: ${ticket.priority}

Description:
${ticket.description || '(no description)'}

Agent Handoff Notes:
${handoffNotes || '(none)'}

Recent Comments:
${commentSummary || '(none)'}

Evaluate readiness for transition from ${ticket.status} to ${targetStatus}.`;

  const response = await getClient().messages.create({
    model: config.aiModel,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  const jsonText = extractJSON(text);
  if (!jsonText) throw new Error('Gate validator returned no JSON');

  const parsed = JSON.parse(jsonText);
  return {
    approved: Boolean(parsed.approved),
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    assessment: parsed.assessment || '',
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
  };
}
