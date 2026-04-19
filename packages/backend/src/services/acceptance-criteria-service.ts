import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface AcceptanceCriteriaResult {
  criteria: string[];
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}

function fallback(): AcceptanceCriteriaResult {
  return {
    criteria: [],
    confidence: 'low',
    reasoning: 'Unable to generate acceptance criteria',
  };
}

export async function generateAcceptanceCriteria(ticketId: string): Promise<AcceptanceCriteriaResult> {
  const targetTicket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  if (targetTicket.length === 0) return fallback();

  const t = targetTicket[0];

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const ticketDesc = t.description ? `Description: ${t.description}\n\n` : '';

  const prompt = `You are an agile acceptance criteria expert. Given a software ticket, generate clear, testable acceptance criteria.

Ticket:
- Title: ${t.title}
${ticketDesc}- Type: ticket
- Labels: ${t.assignedPersona || 'none'}

Return JSON with:
{
  "criteria": ["Given... When... Then...", ...],
  "confidence": "low" | "medium" | "high",
  "reasoning": "brief explanation of what you focused on"
}

Rules:
- Generate 3-8 acceptance criteria using Given/When/Then format
- Each criterion must be testable and specific to the ticket
- reasoning: 2-3 sentences max
- Cap criteria array at 10 items`;

  let content: string;
  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    content = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    return fallback();
  }

  let parsed: { criteria: string[]; confidence: string; reasoning: string };
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return fallback();
  }

  const criteria = Array.isArray(parsed.criteria)
    ? parsed.criteria.filter((c: string) => typeof c === 'string' && c.trim().length > 0).slice(0, 10)
    : [];

  return {
    criteria,
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence)
      ? parsed.confidence as 'low' | 'medium' | 'high'
      : 'low',
    reasoning: parsed.reasoning || 'No reasoning provided',
  };
}
